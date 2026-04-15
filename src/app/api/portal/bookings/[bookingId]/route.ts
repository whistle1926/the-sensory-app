import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ bookingId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const nextStatus = typeof body?.status === "string" ? body.status : null;

  if (nextStatus !== "cancelled") {
    return NextResponse.json({ error: "Only cancellation is allowed" }, { status: 400 });
  }

  const email = (session.user.email || "").toLowerCase().trim();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.clientEmail.toLowerCase() !== email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Block cancellations within 24h of session start
  const sessionDate = new Date(booking.date);
  const [hh, mm] = (booking.time || "00:00").split(":").map((n) => parseInt(n, 10));
  sessionDate.setHours(hh || 0, mm || 0, 0, 0);
  const hoursUntil = (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 24) {
    return NextResponse.json(
      { error: "Bookings within 24 hours cannot be cancelled here. Please contact us directly." },
      { status: 400 }
    );
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ success: true });
}
