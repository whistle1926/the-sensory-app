/**
 * Daily cron — sends an appointment reminder email to everyone whose
 * appointment falls on "tomorrow" (UK time). Called by Vercel Cron at
 * 09:00 UTC (10:00 BST / 09:00 GMT) per /vercel.json.
 *
 * Hobby-plan Vercel only allows daily crons, so we send the whole
 * tomorrow batch in one morning sweep rather than firing precisely 24h
 * before each individual time. Functionally still "the day before",
 * which is what clients expect.
 *
 * `reminderSentAt` is the idempotency key — even if Vercel re-fires the
 * cron twice in the same day we'll never double-email a given booking.
 *
 * Auth: Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>` header.
 * Set CRON_SECRET in the Vercel environment to a long random string. Local
 * tests can hit the endpoint with the same header.
 *
 * Email delivery uses the existing Mailcub transport (`sendTransactionalEmail`).
 * If Mailcub isn't configured we silently skip the send and DON'T mark the
 * reminder as sent, so once Patrick configures Mailcub the next cron tick
 * will pick the booking up again.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { sendMail } from "@/lib/mailer";
import {
  checkAiHealth,
  raiseAiKeyTask,
  resolveAiKeyTask,
  type AiHealth,
} from "@/lib/ai-model";
import {
  getEnabledAutomation,
  renderTemplate,
  variablesForBooking,
} from "@/lib/booking-automation";
import { sendDueFeedbackForms } from "@/lib/booking-feedback";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BookingForReminder {
  id: string;
  service: string;
  date: Date;
  time: string;
  duration: string;
  clientName: string;
  clientEmail: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  // Timing-safe compare so we don't leak partial-match info to anyone
  // brute-forcing the cron token. Length mismatch short-circuits.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── AI early-warning health check ──────────────────────────────────
  // Piggy-backed onto this daily cron because Vercel's Hobby plan caps us
  // at 2 crons. Pings Claude once; if the AI is down, OR the primary model
  // was retired and we silently fell back, email an alert so the model
  // list in src/lib/ai-model.ts gets refreshed before it ever bites a
  // user. Entirely best-effort — wrapped so it can never break reminders.
  let aiHealth: AiHealth | null = null;
  try {
    aiHealth = await checkAiHealth();
    if (!aiHealth.ok || aiHealth.fellBack) {
      const settings = await prisma.emailSettings.findUnique({
        where: { id: "default" },
      });
      const to = settings?.senderEmail || "patrick@thesensorysubmarine.com";
      const safeErr = (aiHealth.error || "unknown").replace(/</g, "&lt;");
      const subject = aiHealth.ok
        ? `⚠️ Sensory AI: primary model "${aiHealth.primary}" retired — running on backup`
        : "🚨 Sensory AI is DOWN — report writing & AI features failing";
      const html = aiHealth.ok
        ? `<p>Heads up — Anthropic appears to have retired the primary AI model <strong>${aiHealth.primary}</strong>.</p>
           <p>The app automatically switched to <strong>${aiHealth.modelUsed}</strong>, so report writing and the other AI features still work — there is <strong>no client impact</strong> right now.</p>
           <p><strong>Action when convenient:</strong> update the model list at the top of <code>src/lib/ai-model.ts</code> so a current model is the primary again.</p>
           <p style="color:#888;font-size:12px;">Automated daily AI health check · The Sensory Submarine</p>`
        : `<p><strong>The AI features are currently failing.</strong> Report generation, AI tidy-up, summaries, leaflet generation and programme demo images will all error until this is fixed.</p>
           <p>Primary model: <strong>${aiHealth.primary}</strong></p>
           <p>Error: <code>${safeErr}</code></p>
           <p><strong>Likely causes:</strong> the ANTHROPIC_API_KEY is missing or invalid, the Anthropic account is out of credit, or every configured model was retired at once. Check the key &amp; billing in the Anthropic console, or refresh the model list in <code>src/lib/ai-model.ts</code>.</p>
           <p style="color:#888;font-size:12px;">Automated daily AI health check · The Sensory Submarine</p>`;
      await sendMail({ to, subject, html });
    }
    // Also raise (or clear) an admin task, so a broken key is flagged
    // right in /tasks where it can be actioned — not just in an email
    // that might be missed. (The real-time 401 trigger in
    // createMessageResilient raises the same task the moment a live AI
    // call fails; this daily pass is the backstop + the clearer.)
    if (aiHealth.ok) await resolveAiKeyTask();
    else await raiseAiKeyTask(aiHealth.error);
  } catch (err) {
    console.error("[ai-health] check failed (non-fatal)", err);
  }

  const now = new Date();
  // "Tomorrow in UK" — formatted as YYYY-MM-DD using Europe/London so we
  // correctly cross BST/GMT boundaries and don't drift on day-of-week.
  const tomorrowUk = ukDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  // Wide DB filter so the index range scan is small; we narrow in JS.
  const candidates = (await prisma.booking.findMany({
    where: {
      status: { not: "cancelled" },
      reminderSentAt: null,
      date: {
        gte: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        lte: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      service: true,
      date: true,
      time: true,
      duration: true,
      clientName: true,
      clientEmail: true,
    },
  })) as BookingForReminder[];

  // Compare each candidate's appointment UK-date against tomorrowUk. This
  // catches every booking on the target day regardless of the time stored.
  const due = candidates.filter((b) => {
    const t = appointmentTimestamp(b.date, b.time);
    return ukDateString(t) === tomorrowUk;
  });

  let sent = 0;
  let failed = 0;
  for (const b of due) {
    try {
      const result = await sendReminderEmail(b);
      if (result.ok) {
        await prisma.booking.update({
          where: { id: b.id },
          data: { reminderSentAt: new Date() },
        });
        sent++;
      } else {
        failed++;
        console.error("[booking-reminder] send failed", b.id, result.error);
      }
    } catch (err) {
      failed++;
      console.error("[booking-reminder] exception", b.id, err);
    }
  }

  // ── Post-appointment feedback sweep ────────────────────────────────
  // Piggy-backed here (Hobby plan caps us at 2 crons). Emails the feedback
  // form ~1 week after appointments for opted-in services. Wrapped so it can
  // never break the reminder run.
  let feedback: Awaited<ReturnType<typeof sendDueFeedbackForms>> | null = null;
  try {
    feedback = await sendDueFeedbackForms(now);
  } catch (err) {
    console.error("[booking-feedback] sweep failed (non-fatal)", err);
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    candidates: candidates.length,
    due: due.length,
    sent,
    failed,
    feedback,
    ai: aiHealth,
  });
}

/**
 * Combine the stored UTC midnight (e.g. "2026-04-16T23:00Z" for an April 17
 * BST booking) with the local-time string ("10:30") to get the actual UTC
 * appointment timestamp. Works for both BST and GMT because the stored
 * date already encodes the UK day boundary in UTC.
 */
/** YYYY-MM-DD calendar string for the given timestamp in UK time. */
function ukDateString(d: Date): string {
  // 'en-CA' formats as YYYY-MM-DD by default — no manual parsing needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function appointmentTimestamp(date: Date, time: string): Date {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    // Defensive: a malformed time string shouldn't blow up the cron run.
    return new Date(date);
  }
  const dt = new Date(date);
  dt.setUTCMinutes(dt.getUTCMinutes() + h * 60 + m);
  return dt;
}

async function sendReminderEmail(b: BookingForReminder) {
  const automation = await getEnabledAutomation("reminder_24h");
  if (!automation) {
    return { ok: false, error: "reminder_24h automation disabled or missing" };
  }
  const vars = await variablesForBooking({
    clientName: b.clientName,
    service: b.service,
    date: b.date,
    time: b.time,
    duration: b.duration,
    pricePence: 0,
  });
  return sendTransactionalEmail({
    to: b.clientEmail,
    subject: renderTemplate(automation.subject, vars),
    html: renderTemplate(automation.bodyHtml, vars),
  });
}

