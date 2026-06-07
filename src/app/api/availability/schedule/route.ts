import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveManageableService } from "@/lib/booking-auth";

type DaySchedule = { enabled: boolean; intervals: { start: string; end: string }[] };

/** Read the 7-day schedule for a serviceId (or null = global default). */
async function readSchedule(serviceId: string | null) {
  const rows = await prisma.weeklyHours.findMany({
    where: { serviceId },
    orderBy: { dayOfWeek: "asc" },
  });
  const schedule: Record<number, DaySchedule> = {};
  for (let d = 0; d <= 6; d++) {
    const row = rows.find((r) => r.dayOfWeek === d);
    schedule[d] = row
      ? {
          enabled: row.enabled,
          intervals: row.intervals as unknown as { start: string; end: string }[],
        }
      : { enabled: false, intervals: [] };
  }
  return schedule;
}

/**
 * Admin GET — weekly schedule for a service.
 *   ?service=<slug>   (omit for the global default calendar; admin only)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const slug = new URL(req.url).searchParams.get("service");
  const resolved = await resolveManageableService(session, slug);
  if (!resolved.ok)
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  return NextResponse.json(await readSchedule(resolved.serviceId));
}

/**
 * Admin POST — save the full weekly schedule for a service.
 * Body: { "0": { enabled, intervals }, ..., "6": {...} }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const slug = new URL(req.url).searchParams.get("service");
  const resolved = await resolveManageableService(session, slug);
  if (!resolved.ok)
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const { serviceId } = resolved;
  const body = await req.json();

  for (let d = 0; d <= 6; d++) {
    const day = body[String(d)];
    if (!day) continue;
    // Find-then-write rather than upsert: the compound unique
    // (serviceId, dayOfWeek) has a nullable serviceId, which Prisma's
    // generated unique-where input can't express as null. findFirst
    // resolves serviceId=null to `IS NULL` correctly.
    const existing = await prisma.weeklyHours.findFirst({
      where: { serviceId, dayOfWeek: d },
      select: { id: true },
    });
    const payload = {
      enabled: day.enabled ?? false,
      intervals: day.intervals ?? [],
    };
    if (existing) {
      await prisma.weeklyHours.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.weeklyHours.create({
        data: { serviceId, dayOfWeek: d, ...payload },
      });
    }
  }

  return NextResponse.json(await readSchedule(serviceId));
}
