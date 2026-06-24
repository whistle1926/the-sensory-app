/**
 * Auto-send the intake / referral form when a booking is paid.
 *
 * Wired into the FireBuddy webhook (payment.completed → booking branch):
 * the moment a booking for an opted-in service is paid, the client is
 * emailed the referral form so the paperwork is in motion before the
 * appointment. Opt-in is per service via
 * `BookingService.autoSendReferralForm` (set in the Services editor).
 *
 * Safe to call more than once — a `Booking.referralFormSentAt` stamp makes
 * it idempotent, so a webhook firing twice never double-sends.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

function baseUrl(): string {
  return (
    (process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "").replace(/\/$/, "") || "https://portal.thesensorysubmarine.com"
  );
}

/** The intake/referral form is the published form flagged `createsClient`
 * (e.g. "OT Initial Referral Form"). Returns null if none is configured. */
async function findReferralForm() {
  const forms = await prisma.form.findMany({
    where: { isPublished: true },
    select: { id: true, slug: true, title: true, settings: true },
  });
  const byFlag = forms.find(
    (f) => (f.settings as { createsClient?: boolean } | null)?.createsClient,
  );
  if (byFlag) return byFlag;
  // Fallback: a published form whose slug looks like a referral form.
  return forms.find((f) => /referral/i.test(f.slug)) ?? null;
}

/**
 * Email the referral form to a paid booking's client, once. Best-effort:
 * callers should not let a failure here roll back the payment handling.
 *
 * @returns a short status for logging/telemetry.
 */
export async function sendBookingReferralForm(bookingId: string): Promise<
  | { sent: false; reason: string }
  | { sent: true; formSlug: string; to: string }
> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      service: true,
      clientName: true,
      clientEmail: true,
      referralFormSentAt: true,
    },
  });
  if (!booking) return { sent: false, reason: "booking not found" };
  if (booking.referralFormSentAt)
    return { sent: false, reason: "already sent" };
  if (!booking.clientEmail) return { sent: false, reason: "no client email" };

  // Is this service opted in?
  const service = await prisma.bookingService.findUnique({
    where: { slug: booking.service },
    select: { autoSendReferralForm: true, title: true },
  });
  if (!service?.autoSendReferralForm)
    return { sent: false, reason: "service not opted in" };

  const form = await findReferralForm();
  if (!form) return { sent: false, reason: "no referral form configured" };

  // Stamp first so a concurrent/duplicate webhook can't double-send. If
  // the email then fails we log it; re-sending is a manual action.
  await prisma.booking.update({
    where: { id: booking.id },
    data: { referralFormSentAt: new Date() },
  });

  // Tie the invite to the existing client record if we can match by email.
  const client = await prisma.client.findFirst({
    where: { parentCarerEmail: booking.clientEmail },
    select: { id: true },
  });

  const token = randomBytes(18).toString("base64url");
  await prisma.formInvite.create({
    data: {
      formId: form.id,
      clientId: client?.id ?? null,
      email: booking.clientEmail,
      token,
    },
  });

  const formUrl = `${baseUrl()}/f/${form.slug}?t=${token}`;
  const firstName = booking.clientName?.split(" ")[0] || "there";
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px">Thanks — your booking is confirmed</h1>
      <p style="font-size:14px;color:#333;line-height:1.6">
        Hi ${escapeHtml(firstName)}, thanks for booking your
        <strong>${escapeHtml(service.title)}</strong> with The Sensory Submarine.
      </p>
      <p style="font-size:14px;color:#333;line-height:1.6">
        To help us prepare, please complete this short referral form before
        your appointment — it only takes a few minutes.
      </p>
      <div style="margin-top:20px">
        <a href="${escapeHtml(formUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Complete the referral form
        </a>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#888;line-height:1.5">
        If the button doesn't work, copy and paste this link:<br>
        <a href="${escapeHtml(formUrl)}">${escapeHtml(formUrl)}</a>
      </p>
    </div>
  </body></html>`;

  await sendTransactionalEmail({
    to: booking.clientEmail,
    subject: "Please complete your referral form — The Sensory Submarine",
    html,
  });

  return { sent: true, formSlug: form.slug, to: booking.clientEmail };
}
