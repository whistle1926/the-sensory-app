/**
 * POST /api/bookings/[bookingId]/referral — { notNeeded: boolean }
 *
 * Mark a client as not needing the referral form (Claire, Nov 2026: an
 * ongoing client kept triggering "referral form still outstanding"
 * reminders). Applies to every booking for the same email, so future
 * bookings for them stay quiet too; unticking turns it back on.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const body = (await req.json().catch(() => ({}))) as { notNeeded?: unknown };
  if (typeof body.notNeeded !== "boolean")
    return NextResponse.json({ error: "notNeeded must be true or false" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, clientEmail: true, clientName: true, ownerId: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (role !== "SUPER_ADMIN" && booking.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const where = booking.clientEmail
    ? { clientEmail: { equals: booking.clientEmail, mode: "insensitive" as const } }
    : { id: booking.id };
  const res = await prisma.booking.updateMany({
    where,
    data: { referralNotNeeded: body.notNeeded },
  });

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "booking.referral_not_needed",
    targetType: "booking",
    targetId: booking.id,
    meta: { notNeeded: body.notNeeded, clientName: booking.clientName, bookings: res.count },
    req,
  });

  return NextResponse.json({ ok: true, notNeeded: body.notNeeded, bookings: res.count });
}
