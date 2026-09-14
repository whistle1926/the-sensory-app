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
import {
  sendBookingConfirmationEmail,
  PRACTICE_ADMIN_EMAIL,
} from "./booking-automation";
import { sendTransactionalEmail } from "./email";


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

    // Now that it's actually paid, send the client their confirmation —
    // the email that used to go out at booking time, before payment. For a
    // block, list every session in the group. Best-effort.
    try {
      const sessions = booking.groupId
        ? await prisma.booking.findMany({
            where: { groupId: booking.groupId },
            orderBy: [{ date: "asc" }, { time: "asc" }],
            select: { date: true, time: true, price: true },
          })
        : [{ date: booking.date, time: booking.time, price: booking.price }];
      const totalPence = sessions.reduce((sum, s) => sum + s.price, 0);
      await sendBookingConfirmationEmail({
        to: booking.clientEmail,
        clientName: booking.clientName,
        service: booking.service,
        date: booking.date,
        time: booking.time,
        duration: booking.duration || "",
        pricePence: totalPence,
        sessions: sessions.map((s) => ({ date: s.date, time: s.time })),
      });
    } catch (err) {
      console.error("[booking] paid-confirmation email failed:", err);
    }

    // Tell the practice admin inbox the money has landed, so Claire can
    // reconcile without watching Fire. Best-effort.
    try {
      const when = booking.date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
      });
      await sendTransactionalEmail({
        to: PRACTICE_ADMIN_EMAIL,
        subject: `Payment received: ${booking.service} — ${booking.clientName}`,
        html: `<p>A booking payment has landed in Fire.</p>
<ul>
  <li><strong>Service:</strong> ${booking.service}</li>
  <li><strong>Client:</strong> ${booking.clientName} (${booking.clientEmail})</li>
  <li><strong>First session:</strong> ${when} at ${booking.time}</li>
  <li><strong>Status:</strong> now confirmed</li>
</ul>
<p>It's marked paid on the bookings page in the portal.</p>`,
      });
    } catch (err) {
      console.error("[booking] admin payment notice failed:", err);
    }
  }
}
