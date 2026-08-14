import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveManageableService } from "@/lib/booking-auth";

/**
 * Date overrides (specific-date availability) scoped per service.
 * These are how monthly assessment clinics are modelled — an associate
 * adds the exact dates their Armagh/Antrim/Ballymoney clinic runs.
 *
 *   ?service=<slug>   (omit for the global default calendar; admin only)
 */

// GET — list this service's overrides.
export async function GET(req: NextRequest) {
  const session = await auth();
  const slug = new URL(req.url).searchParams.get("service");
  const resolved = await resolveManageableService(session, slug);
  if (!resolved.ok)
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const overrides = await prisma.dateOverride.findMany({
    where: { serviceId: resolved.serviceId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    overrides.map((o) => ({
      id: o.id,
      date: o.date.toISOString().split("T")[0],
      available: o.available,
      intervals: o.intervals,
      blockedIntervals: o.blockedIntervals,
    })),
  );
}

// POST — add or update an override for this service.
// Body: { date: "2026-04-10", available: false, intervals?: [...] }
export async function POST(req: NextRequest) {
  const session = await auth();
  const slug = new URL(req.url).searchParams.get("service");
  const resolved = await resolveManageableService(session, slug);
  if (!resolved.ok)
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const body = await req.json();
  const { date, available, intervals, blockedIntervals } = body;
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const dateObj = new Date(date + "T00:00:00Z");
  // Find-then-write: the compound unique (serviceId, date) has a
  // nullable serviceId that Prisma's unique-where can't express as null.
  // Three shapes, and only one applies at a time:
  //   available=false            → day off
  //   available=true + intervals → these hours replace the day
  //   available=true + blocked   → normal day minus these windows
  const blocked = Array.isArray(blockedIntervals) ? blockedIntervals : null;
  const hasBlocked = !!blocked?.length;
  // Prisma wants DbNull, not null, to clear a nullable Json column.
  const payload = {
    available: available ?? false,
    intervals:
      available && !hasBlocked ? (intervals || []) : Prisma.DbNull,
    blockedIntervals:
      available && hasBlocked ? blocked : Prisma.DbNull,
  };
  const found = await prisma.dateOverride.findFirst({
    where: { serviceId: resolved.serviceId, date: dateObj },
    select: { id: true },
  });
  const override = found
    ? await prisma.dateOverride.update({ where: { id: found.id }, data: payload })
    : await prisma.dateOverride.create({
        data: { serviceId: resolved.serviceId, date: dateObj, ...payload },
      });

  return NextResponse.json({
    id: override.id,
    date: override.date.toISOString().split("T")[0],
    available: override.available,
    intervals: override.intervals,
    blockedIntervals: override.blockedIntervals,
  });
}

// DELETE — remove an override (?id=...). Ownership is enforced by
// re-checking the row's serviceId against what the caller may manage.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.dateOverride.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: true });

  // Re-resolve against the row's own service so an associate can't
  // delete another service's override by guessing an id.
  const owningSlug = existing.serviceId
    ? (
        await prisma.bookingService.findUnique({
          where: { id: existing.serviceId },
          select: { slug: true },
        })
      )?.slug ?? null
    : null;
  const resolved = await resolveManageableService(session, owningSlug);
  if (!resolved.ok)
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  await prisma.dateOverride.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
