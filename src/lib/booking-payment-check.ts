/**
 * Confirm a booking payment with Fire rather than waiting for a webhook.
 *
 * Bookings had the same blind spot as courses: the reference we send is the
 * booking id, and Fire truncates it to 18 characters, so the webhook could
 * never find the booking it referred to. No booking has ever been marked
 * paid that way. Nobody noticed only because online booking payments hadn't
 * been used in anger yet — a client would have paid and stayed "pending",
 * with no confirmation and no referral form.
 *
 * The success page asks Fire outright instead. Block bookings are several
 * rows paid by one payment, so the whole group is confirmed together.
 */
import { prisma } from "./prisma";
import { fetchFireStatus } from "./fire-payment-status";
import { completeBookingPayment } from "./booking-payment-complete";

export async function checkBookingPayment(
  bookingId: string,
): Promise<{ paid: boolean; status: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, paymentStatus: true, paymentRef: true, groupId: true },
  });
  if (!booking) return { paid: false, status: "not found" };
  if (booking.paymentStatus === "paid") return { paid: true, status: "already paid" };
  if (!booking.paymentRef) return { paid: false, status: "no payment started" };

  const check = await fetchFireStatus(booking.paymentRef);
  if (!check.paid) return { paid: false, status: check.status };

  // One payment can cover a block of sessions — confirm them all.
  const ids = booking.groupId
    ? (
        await prisma.booking.findMany({
          where: { groupId: booking.groupId },
          select: { id: true },
        })
      ).map((b) => b.id)
    : [booking.id];

  for (const id of ids) {
    try {
      await completeBookingPayment(id, booking.paymentRef, {
        // A block is one sale: credit the income and send the referral form
        // once, against the session the client actually paid from.
        primary: id === booking.id,
      });
    } catch (err) {
      console.error("[booking-payment-check] completing failed:", id, err);
    }
  }
  return { paid: true, status: "paid" };
}
