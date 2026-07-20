import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBookingEvent } from "@/lib/google-calendar";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const body = await req.json();
  const { status } = body;

  if (!status || !["confirmed", "cancelled", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // If this cancellation removes a booking that was synced to the owner's
  // Google Calendar, take the event back out too. Best-effort — never blocks
  // the cancel. We read the event id + owner BEFORE the update.
  if (status === "cancelled") {
    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { googleEventId: true, ownerId: true },
    });
    if (existing?.googleEventId && existing.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: existing.ownerId },
        select: { googleRefreshToken: true, googleCalendarId: true },
      });
      if (owner?.googleRefreshToken) {
        const ok = await deleteBookingEvent({
          refreshToken: owner.googleRefreshToken,
          calendarId: owner.googleCalendarId,
          eventId: existing.googleEventId,
        }).catch(() => false);
        if (ok) {
          await prisma.booking
            .update({ where: { id: bookingId }, data: { googleEventId: null } })
            .catch(() => {});
        }
      }
    }
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });

  return NextResponse.json(booking);
}
