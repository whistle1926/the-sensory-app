/**
 * Auto-send the post-appointment feedback form ~1 week after an
 * appointment.
 *
 * Runs from the daily booking-reminders cron (Vercel Hobby caps us at 2
 * crons, so this piggy-backs the existing sweep rather than adding a third).
 * Each day it finds bookings whose appointment was 7–10 days ago, for a
 * service opted-in via `BookingService.autoSendFeedbackForm` (set in the
 * Services editor), and emails the client the feedback form once.
 *
 * The email copy lives on the feedback Form's `settings.emailSubject` /
 * `settings.emailBody` so admins can edit it in the form builder — the same
 * copy the manual "Send form" dialog pre-fills. `{{formTitle}}` /
 * `{{formUrl}}` tokens are substituted; a bare "[Insert Feedback Form Link]"
 * placeholder (as pasted from a draft) is also turned into the button.
 *
 * Idempotent: a `Booking.feedbackFormSentAt` stamp means a re-fired cron
 * never double-sends. Block bookings (multi-session groups) only trigger
 * once, off the final session in the group.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";

/** How many days after the appointment to send feedback, and the trailing
 * window so a cron that missed a day or two still catches the booking. */
const FEEDBACK_AFTER_DAYS = 7;
const WINDOW_DAYS = 3; // send when the appointment was 7–10 days ago
const DAY_MS = 24 * 60 * 60 * 1000;

/** Default copy, used only if the feedback form has no saved email copy. */
export const DEFAULT_FEEDBACK_SUBJECT =
  "How was your OT assessment? — a quick bit of feedback";
export const DEFAULT_FEEDBACK_BODY = `Hi,

Thank you for recently attending an Occupational Therapy assessment with The Sensory Submarine.

We hope you found your appointment helpful. We are always evaluating our services and would really appreciate it if you could spare just one minute to complete our short feedback form using the link below.

Your feedback helps us continue to provide the very best support for children and families, and we genuinely value every response.

**Complete the feedback form here:**
[Insert Feedback Form Link]

Thank you again for choosing The Sensory Submarine. We truly appreciate your support.

The Sensory Submarine Team`;

function baseUrl(): string {
  return (
    (process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "").replace(/\/$/, "") || "https://portal.thesensorysubmarine.com"
  );
}

/** The feedback form is the published form flagged `sendsFeedback` in its
 * settings (fallback: a published form whose slug looks like feedback). */
async function findFeedbackForm() {
  const forms = await prisma.form.findMany({
    where: { isPublished: true },
    select: { id: true, slug: true, title: true, settings: true },
  });
  const byFlag = forms.find(
    (f) => (f.settings as { sendsFeedback?: boolean } | null)?.sendsFeedback,
  );
  if (byFlag) return byFlag;
  return forms.find((f) => /feedback/i.test(f.slug)) ?? null;
}

/**
 * Turn the stored plain-text body into HTML: substitute the link tokens
 * with a branded button, escape everything else, and keep paragraph breaks.
 * Supports `{{formUrl}}`, `{{formTitle}}`, and a literal
 * "[Insert Feedback Form Link]" placeholder from a pasted draft.
 */
function bodyToHtml(body: string, formUrl: string, formTitle: string): string {
  const button = `<a href="${escapeHtml(formUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">${escapeHtml(
    formTitle,
  )}</a>`;
  // Split into paragraphs on blank lines; render each, swapping the link
  // placeholders for the button and **bold** for <strong>.
  const paras = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  let linkPlaced = false;
  const htmlParas = paras.map((p) => {
    const linkPlaceholder =
      /\{\{\s*formUrl\s*\}\}|\[insert feedback form link\]/i;
    if (linkPlaceholder.test(p)) {
      // A paragraph that is (or contains) the link → replace with the button.
      linkPlaced = true;
      const before = p.split(linkPlaceholder)[0].trim();
      const prefix = before
        ? `<p style="margin:0 0 12px;">${inline(before, formTitle)}</p>`
        : "";
      return `${prefix}<p style="margin:0 0 18px;">${button}</p>`;
    }
    return `<p style="margin:0 0 14px;">${inline(p, formTitle)}</p>`;
  });
  // Safety net: if the copy was edited to drop the link placeholder, still
  // append the button so the email always has a working link.
  if (!linkPlaced) htmlParas.push(`<p style="margin:0 0 18px;">${button}</p>`);
  return htmlParas.join("\n");
}

/** Escape, then apply light inline formatting (**bold**, {{formTitle}}, line breaks). */
function inline(text: string, formTitle: string): string {
  let out = escapeHtml(text.replace(/\{\{\s*formTitle\s*\}\}/g, formTitle));
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\n/g, "<br/>");
  return out;
}

/**
 * Email the feedback form to a single booking's client, once. Best-effort.
 * @returns a short status for logging/telemetry.
 */
export async function sendBookingFeedbackForm(bookingId: string): Promise<
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
      feedbackFormSentAt: true,
    },
  });
  if (!booking) return { sent: false, reason: "booking not found" };
  if (booking.feedbackFormSentAt)
    return { sent: false, reason: "already sent" };
  if (!booking.clientEmail) return { sent: false, reason: "no client email" };

  const service = await prisma.bookingService.findUnique({
    where: { slug: booking.service },
    select: { autoSendFeedbackForm: true, title: true },
  });
  if (!service?.autoSendFeedbackForm)
    return { sent: false, reason: "service not opted in" };

  const form = await findFeedbackForm();
  if (!form) return { sent: false, reason: "no feedback form configured" };

  // Stamp first so a concurrent/duplicate run can't double-send.
  await prisma.booking.update({
    where: { id: booking.id },
    data: { feedbackFormSentAt: new Date() },
  });

  const client = await prisma.client.findFirst({
    where: { parentCarerEmail: booking.clientEmail },
    select: { id: true },
  });

  const token = randomBytes(18).toString("base64url");
  await prisma.formInvite.create({
    data: { formId: form.id, clientId: client?.id ?? null, email: booking.clientEmail, token },
  });

  const formUrl = `${baseUrl()}/f/${form.slug}?t=${token}`;
  const s = (form.settings as { emailSubject?: string; emailBody?: string } | null) ?? {};
  const subjectTpl = s.emailSubject?.trim() || DEFAULT_FEEDBACK_SUBJECT;
  const bodyTpl = s.emailBody?.trim() || DEFAULT_FEEDBACK_BODY;
  const subject = subjectTpl.replace(/\{\{\s*formTitle\s*\}\}/g, form.title);

  const html = brandedEmail({
    bodyHtml:
      bodyToHtml(bodyTpl, formUrl, form.title) +
      `<p style="margin:18px 0 0;font-size:11px;color:#999999;">If the button doesn't work, copy and paste this link:<br/><a href="${escapeHtml(
        formUrl,
      )}" style="color:#999999;">${escapeHtml(formUrl)}</a></p>`,
  });

  await sendTransactionalEmail({ to: booking.clientEmail, subject, html });

  return { sent: true, formSlug: form.slug, to: booking.clientEmail };
}

/**
 * Daily sweep: find every booking whose appointment was 7–10 days ago, for
 * an opted-in service, not yet feedback-stamped, and send. Block bookings
 * are de-duplicated by group (only the final session triggers). Returns a
 * summary for the cron response.
 */
export async function sendDueFeedbackForms(now = new Date()): Promise<{
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  // A booking is "due" when its appointment date is between 10 and 7 days
  // ago. The window (rather than an exact day) means a cron that missed a
  // run still catches it, and it naturally excludes long-past bookings so a
  // first deploy doesn't blast historical clients.
  const lte = new Date(now.getTime() - FEEDBACK_AFTER_DAYS * DAY_MS);
  const gte = new Date(now.getTime() - (FEEDBACK_AFTER_DAYS + WINDOW_DAYS) * DAY_MS);

  const candidates = await prisma.booking.findMany({
    where: {
      status: { not: "cancelled" },
      feedbackFormSentAt: null,
      clientEmail: { not: "" },
      date: { gte, lte },
    },
    select: {
      id: true,
      date: true,
      groupId: true,
      sessionIndex: true,
      clientEmail: true,
    },
    orderBy: { date: "asc" },
  });

  // De-dupe multi-session groups: only act on the latest session in a
  // group, so a block of sessions produces a single feedback email.
  const latestInGroup = new Map<string, string>(); // groupId -> bookingId (latest date)
  for (const b of candidates) {
    if (!b.groupId) continue;
    const cur = latestInGroup.get(b.groupId);
    if (!cur) latestInGroup.set(b.groupId, b.id);
    else {
      const curB = candidates.find((c) => c.id === cur)!;
      if (b.date > curB.date) latestInGroup.set(b.groupId, b.id);
    }
  }
  const skipIds = new Set<string>();
  for (const b of candidates) {
    if (b.groupId && latestInGroup.get(b.groupId) !== b.id) skipIds.add(b.id);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const b of candidates) {
    if (skipIds.has(b.id)) {
      skipped++;
      continue;
    }
    try {
      const r = await sendBookingFeedbackForm(b.id);
      if (r.sent) sent++;
      else skipped++;
    } catch (err) {
      failed++;
      console.error("[booking-feedback] exception", b.id, err);
    }
  }

  return { candidates: candidates.length, sent, skipped, failed };
}
