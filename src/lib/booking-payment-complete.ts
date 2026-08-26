/**
 * What happens when a booking is paid for.
 *
 * Lifted out of the webhook so the webhook and the direct check against Fire
 * share one definition — two copies would eventually disagree about whether
 * a client is confirmed.
 *
 * Idempotent: returns early if already paid, so a webhook and a poll racing
 * each other can't double-credit the income tracker or re-send the form.
 */
import { prisma } from "./prisma";
import { sendBookingReferralForm } from "./booking-referral";

export async function completeBookingPayment(
  bookingId: string,
  paymentId: string,
  opts: { primary?: boolean } = {},
): Promise<void> {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true },
  });
  if (!existing || existing.paymentStatus === "paid") return;

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: "paid", paymentRef: paymentId, status: "confirmed" },
  });

  const isPrimary = opts.primary !== false;

  if (isPrimary && booking.price > 0) {
    try {
      await prisma.incomeEntry.upsert({
        where: { source_reference: { source: "BOOKING", reference: booking.id } },
        update: {
          amount: booking.price,
          description: `${booking.service} — ${booking.clientName}`,
        },
        create: {
          amount: booking.price,
          source: "BOOKING",
          reference: booking.id,
          description: `${booking.service} — ${booking.clientName}`,
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[booking] income tracker failed:", err);
    }
  }

  // The intake/referral form, for services opted in. Best-effort and
  // idempotent — it must never disturb the payment being recorded.
  if (isPrimary) {
    try {
      await sendBookingReferralForm(booking.id);
    } catch (err) {
      console.error("[booking] referral form failed:", err);
    }
  }
}
