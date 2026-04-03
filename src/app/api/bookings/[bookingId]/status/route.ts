import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    service: booking.service,
    date: booking.date.toISOString(),
    time: booking.time,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
  });
}
