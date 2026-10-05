/**
 * Auto-send the intake / referral form for a booking, and chase it.
 *
 * Sent when a parent's booking is paid (FireBuddy webhook / payment
 * completion), or straight away for a booking made from the back end or one
 * that needs no payment. Every service is on by default (Claire, Oct 2026:
 * "it's for all"); `BookingService.autoSendReferralForm` stays as a
 * per-service off switch. Parents who've already returned the referral form
 * aren't sent it again.
 *
 * `sendReferralChasers` (daily cron) re-sends the link about a week before
 * the appointment if the form still isn't back, and lets admin know.
 *
 * Safe to call more than once — a `Booking.referralFormSentAt` stamp makes
 * it idempotent, so a webhook firing twice never double-sends.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";
import { PRACTICE_ADMIN_EMAIL } from "@/lib/booking-automation";
import { appointmentTimestamp, ukDateString } from "@/lib/booking-reminder";

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

/** Has this parent already returned the referral form (by any route)? */
async function hasReturnedReferral(formId: string, email: string): Promise<boolean> {
  const e = { equals: email, mode: "insensitive" as const };
  const found = await prisma.formSubmission.findFirst({
    where: {
      formId,
      OR: [
        { submitterEmail: e },
        { invite: { email: e } },
        { invite: { client: { parentCarerEmail: e } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

function referralEmailHtml(opts: {
  firstName: string;
  formUrl: string;
  formTitle: string;
  intro: string;
}): string {
  return brandedEmail({
    bodyHtml: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(opts.firstName)}</p>
      <p style="margin:0 0 14px;">${opts.intro}</p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(opts.formUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">
          ${escapeHtml(opts.formTitle)}
        </a>
      </p>
      <p style="margin:0 0 14px;">
        If you've any issues or questions, please contact Claire &mdash;
        <a href="mailto:${PRACTICE_ADMIN_EMAIL}">${PRACTICE_ADMIN_EMAIL}</a>
      </p>
      <p style="margin:0 0 14px;">Thank you and see you soon.</p>
      <p style="margin:0;"><strong>The Sensory Submarine Team</strong></p>
      <p style="margin:18px 0 0;font-size:11px;color:#999999;">
        If the button doesn't work, copy and paste this link:<br/>
        <a href="${escapeHtml(opts.formUrl)}" style="color:#999999;">${escapeHtml(opts.formUrl)}</a>
      </p>`,
  });
}

/**
 * Email the referral form to a booking's client, once. Best-effort:
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

  // Switched off for this service?
  // Custom ("Other") bookings have no service row — they still get it.
  const service = await prisma.bookingService.findUnique({
    where: { slug: booking.service },
    select: { autoSendReferralForm: true, title: true },
  });
  if (service && !service.autoSendReferralForm)
    return { sent: false, reason: "service switched off" };

  const form = await findReferralForm();
  if (!form) return { sent: false, reason: "no referral form configured" };

  if (await hasReturnedReferral(form.id, booking.clientEmail))
    return { sent: false, reason: "referral form already returned" };

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
  const html = referralEmailHtml({
    firstName,
    formUrl,
    formTitle: form.title,
    intro:
      "Ahead of your upcoming appointment with The Sensory Submarine, please take some time to complete the referral form by following the link below:",
  });

  await sendTransactionalEmail({
    to: booking.clientEmail,
    subject: `Please complete your referral form — ${service?.title ?? booking.service}`,
    html,
  });

  return { sent: true, formSlug: form.slug, to: booking.clientEmail };
}

/** How far ahead of the appointment the chaser goes out. */
const CHASE_DAYS_BEFORE = 7;
/** Don't chase a form we only sent in the last couple of days. */
const CHASE_MIN_AGE_MS = 2 * 864e5;

/**
 * Daily sweep: for appointments a week or less away whose referral form
 * still isn't back, re-send the parent their link and tell admin. One
 * chaser per booking (`referralReminderSentAt`). Best-effort.
 */
export async function sendReferralChasers(now = new Date()): Promise<{
  checked: number;
  chased: number;
}> {
  const form = await findReferralForm();
  if (!form) return { checked: 0, chased: 0 };

  const candidates = await prisma.booking.findMany({
    where: {
      status: { not: "cancelled" },
      referralFormSentAt: { not: null, lte: new Date(now.getTime() - CHASE_MIN_AGE_MS) },
      referralReminderSentAt: null,
      // A block chases once, on its first session.
      OR: [{ groupId: null }, { sessionIndex: 1 }],
      date: {
        gte: new Date(now.getTime() - 864e5),
        lte: new Date(now.getTime() + (CHASE_DAYS_BEFORE + 1) * 864e5),
      },
    },
    select: { id: true, service: true, date: true, time: true, clientName: true, clientEmail: true },
  });

  const lastDay = ukDateString(new Date(now.getTime() + CHASE_DAYS_BEFORE * 864e5));
  let chased = 0;
  for (const b of candidates) {
    try {
      const at = appointmentTimestamp(b.date, b.time);
      if (at <= now || ukDateString(at) > lastDay) continue;
      if (!b.clientEmail) continue;
      if (await hasReturnedReferral(form.id, b.clientEmail)) continue;

      // Re-use the link we sent them, so the "sent" list stays tidy.
      const invite = await prisma.formInvite.findFirst({
        where: { formId: form.id, email: { equals: b.clientEmail, mode: "insensitive" } },
        orderBy: { sentAt: "desc" },
        select: { token: true },
      });
      if (!invite) continue;

      await prisma.booking.update({
        where: { id: b.id },
        data: { referralReminderSentAt: now },
      });

      const formUrl = `${baseUrl()}/f/${form.slug}?t=${invite.token}`;
      const when = at.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/London",
      });
      const firstName = b.clientName?.split(" ")[0] || "there";
      await sendTransactionalEmail({
        to: b.clientEmail,
        subject: "Reminder: please complete your referral form",
        html: referralEmailHtml({
          firstName,
          formUrl,
          formTitle: form.title,
          intro: `Just a friendly reminder &mdash; we haven't received your referral form yet, and your appointment is on <strong>${escapeHtml(when)}</strong>. It helps us make the most of your session, so please complete it before then:`,
        }),
      });
      await sendTransactionalEmail({
        to: PRACTICE_ADMIN_EMAIL,
        subject: `Referral form still outstanding — ${b.clientName}`,
        html: brandedEmail({
          bodyHtml: `<p style="margin:0 0 14px;">${escapeHtml(b.clientName)} (${escapeHtml(b.clientEmail)}) hasn't returned the referral form yet. Their appointment is on <strong>${escapeHtml(when)}</strong> at ${escapeHtml(b.time)}.</p><p style="margin:0;">We've emailed them a reminder with their link.</p>`,
        }),
      });
      chased++;
    } catch (err) {
      console.error("[referral-chaser] failed", b.id, err);
    }
  }
  return { checked: candidates.length, chased };
}
