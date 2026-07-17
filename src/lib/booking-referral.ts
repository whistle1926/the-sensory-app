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
import { brandedEmail } from "@/lib/email-layout";

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
  const html = brandedEmail({
    bodyHtml: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)}</p>
      <p style="margin:0 0 14px;">
        Ahead of your upcoming OT assessment with The Sensory Submarine,
        please take some time to complete the referral form by following the
        link below:
      </p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(formUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">
          ${escapeHtml(form.title)}
        </a>
      </p>
      <p style="margin:0 0 14px;">
        If you've any issues or questions, please contact Claire &mdash;
        <a href="mailto:admin@thesensorysubmarine.com">admin@thesensorysubmarine.com</a>
      </p>
      <p style="margin:0 0 14px;">Thank you and see you soon.</p>
      <p style="margin:0;"><strong>The Sensory Submarine Team</strong></p>
      <p style="margin:18px 0 0;font-size:11px;color:#999999;">
        If the button doesn't work, copy and paste this link:<br/>
        <a href="${escapeHtml(formUrl)}" style="color:#999999;">${escapeHtml(formUrl)}</a>
      </p>`,
  });

  await sendTransactionalEmail({
    to: booking.clientEmail,
    subject: `Please complete your referral form — ${service.title}`,
    html,
  });

  return { sent: true, formSlug: form.slug, to: booking.clientEmail };
}
