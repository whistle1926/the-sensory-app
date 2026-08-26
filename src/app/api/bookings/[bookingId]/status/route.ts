import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkBookingPayment } from "@/lib/booking-payment-check";

/**
 * Status for the "thanks for booking" page.
 *
 * While we believe a booking is unpaid we ask Fire outright rather than
 * waiting for a webhook that can't route: Fire truncates our reference to 18
 * characters, so it could never find the booking it named. Only funds Fire
 * has actually confirmed count as paid.
 */
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

  // Still unpaid as far as we know — Fire actually knows.
  if (booking.paymentStatus !== "paid" && booking.price > 0) {
    const check = await checkBookingPayment(bookingId);
    if (check.paid) {
      const fresh = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (fresh) {
        return NextResponse.json({
          service: fresh.service,
          date: fresh.date.toISOString(),
          time: fresh.time,
          clientName: fresh.clientName,
          clientEmail: fresh.clientEmail,
          status: fresh.status,
          paymentStatus: fresh.paymentStatus,
        });
      }
    }
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
