/**
 * The 24-hour appointment reminder.
 *
 * Reminders normally go out in one batch each morning (the
 * /api/cron/booking-reminders sweep), which looks for appointments happening
 * "tomorrow". That leaves a hole: anything booked AFTER a given morning's
 * sweep, for the very next day, is never picked up — the sweep for it has
 * already run, and the next one looks a day further ahead. Those clients
 * silently got no reminder.
 *
 * This module closes that hole and keeps both paths honest by owning the
 * send in one place:
 *
 *   - `sendReminderFor`      renders and sends a single reminder, stamping
 *                            `reminderSentAt` so nothing is ever sent twice.
 *   - `remindersMissedBySweep` decides, at booking time, which of the
 *                            just-created appointments the sweep can no
 *                            longer catch.
 *
 * Deliberately NOT sent for same-day bookings: the reminder copy says the
 * appointment is "tomorrow", which would be plainly wrong, and the client
 * has just this second received a confirmation anyway.
 */
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import {
  getEnabledAutomation,
  renderTemplate,
  variablesForBooking,
} from "@/lib/booking-automation";

/**
 * Hour (UTC) at which the daily sweep runs — must match the cron schedule in
 * vercel.json ("0 9 * * *"). If that schedule changes, change this too, or
 * late bookings will be double-sent or missed again.
 */
export const SWEEP_HOUR_UTC = 9;

/** YYYY-MM-DD for the given instant, as seen in the UK. */
export function ukDateString(d: Date): string {
  // 'en-CA' formats as YYYY-MM-DD by default — no manual parsing needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Combine the stored UTC-midnight date with the local time string to get the
 * real appointment instant. Mirrors the cron's helper — the stored date
 * already encodes the UK day boundary, so adding the local h:m is correct
 * across BST and GMT.
 */
export function appointmentTimestamp(date: Date, time: string): Date {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return new Date(date);
  const dt = new Date(date);
  dt.setUTCMinutes(dt.getUTCMinutes() + h * 60 + m);
  return dt;
}

interface ReminderBooking {
  id: string;
  service: string;
  date: Date;
  time: string;
  duration: string;
  clientName: string;
  clientEmail: string;
}

/**
 * Send one reminder and stamp it. Idempotent via `reminderSentAt`, which is
 * written only after a confirmed send so a transient email failure leaves the
 * booking eligible for the next sweep.
 */
export async function sendReminderFor(
  b: ReminderBooking,
): Promise<{ ok: boolean; error?: string }> {
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
  const res = await sendTransactionalEmail({
    to: b.clientEmail,
    subject: renderTemplate(automation.subject, vars),
    html: renderTemplate(automation.bodyHtml, vars),
  });
  if (!res.ok) return { ok: false, error: res.error };

  await prisma.booking.update({
    where: { id: b.id },
    data: { reminderSentAt: new Date() },
  });
  return { ok: true };
}

/**
 * Of the appointments just booked, which will the morning sweep never reach?
 *
 * An appointment on day A is swept at SWEEP_HOUR_UTC on A-1. So it's missed
 * exactly when that moment has already passed — i.e. the appointment is
 * tomorrow (UK) and today's sweep has already run.
 *
 * Same-day and past appointments are excluded: "tomorrow" wording wouldn't be
 * true, and a reminder seconds after a confirmation is just noise.
 */
export function remindersMissedBySweep<T extends { date: Date; time: string }>(
  bookings: T[],
  now = new Date(),
): T[] {
  const todayUk = ukDateString(now);
  const tomorrowUk = ukDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const sweepRunToday = now.getUTCHours() >= SWEEP_HOUR_UTC;
  if (!sweepRunToday) return []; // today's sweep is still to come — it'll catch them

  return bookings.filter((b) => {
    const when = appointmentTimestamp(b.date, b.time);
    if (when.getTime() <= now.getTime()) return false; // already been and gone
    const day = ukDateString(when);
    if (day === todayUk) return false; // same-day — confirmation covers it
    return day === tomorrowUk;
  });
}

/**
 * Best-effort: send reminders for any of these bookings the sweep can no
 * longer catch. Called after a booking is created; never allowed to throw
 * into the booking flow.
 */
export async function sendLateBookingReminders(
  bookings: ReminderBooking[],
  now = new Date(),
): Promise<{ sent: number; failed: number }> {
  const due = remindersMissedBySweep(bookings, now);
  let sent = 0;
  let failed = 0;
  for (const b of due) {
    try {
      const r = await sendReminderFor(b);
      if (r.ok) sent++;
      else {
        failed++;
        console.error("[late-reminder] send failed", b.id, r.error);
      }
    } catch (err) {
      failed++;
      console.error("[late-reminder] exception", b.id, err);
    }
  }
  return { sent, failed };
}
