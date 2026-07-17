/**
 * Booking automation helpers — variable substitution + default seeding.
 *
 * Both the confirmation handler (POST /api/bookings) and the reminder cron
 * (GET /api/cron/booking-reminders) read their email subject/body from the
 * `BookingAutomation` rows in the DB rather than hard-coded strings. That
 * lets Patrick edit copy from the admin UI and have it take effect on the
 * next send — no redeploy.
 *
 * Variables available in templates (use {{name}}):
 *   client_name, service, date, time, duration, price, deposit, terms
 *
 * `terms` expands to the T&Cs the client agreed to at booking; the others
 * are plain strings. Anything not provided collapses to "" so missing
 * placeholders don't break the layout.
 */
import { prisma } from "@/lib/prisma";
import { renderTermsHtmlFromDb } from "@/lib/booking-terms-store";
import { bookingServiceMetaFromDb } from "@/lib/booking-services";

export interface AutomationVariables {
  client_name: string;
  service: string;
  date: string;
  time: string;
  duration?: string;
  price?: string;
  deposit?: string;
  terms?: string; // raw HTML
  /** "Add to calendar" URL (Google Calendar template link). */
  calendar_link?: string;
  /** Every appointment in the booking as an HTML list — one line for a
   * normal booking, 2-5 for a block ("Session 1 of 5 — ..."). */
  sessions?: string;
  /** Video-call paragraph — ONLY populated for online services, so the
   * reminder can say "we'll send the link" without it appearing on
   * in-person clinic appointments. Empty string otherwise. */
  online_note?: string;
  [key: string]: string | undefined;
}

/** Add `mins` to a "HH:MM" clock time. Clamps at 23:59 rather than
 * rolling into the next day — appointments don't span midnight. */
function addMinutesToClock(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

/**
 * A Google Calendar "add event" link for the booking.
 *
 * We pass the local wall-clock time plus `ctz=Europe/London` rather than
 * converting to UTC — Google applies the timezone, so this stays correct
 * across BST/GMT with no date-maths of our own.
 */
function buildCalendarLink(args: {
  title: string;
  date: Date;
  time: string;
  durationMinutes: number;
}): string {
  // The booking's calendar day AS SEEN IN LONDON (the stored instant can
  // sit at 23:00 UTC the night before during BST).
  const ymd = args.date
    .toLocaleDateString("en-CA", { timeZone: "Europe/London" })
    .replace(/-/g, "");
  const stamp = (t: string) => `${ymd}T${t.replace(":", "")}00`;
  const end = addMinutesToClock(args.time, args.durationMinutes || 60);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: args.title,
    dates: `${stamp(args.time)}/${stamp(end)}`,
    ctz: "Europe/London",
    details: "Booked with The Sensory Submarine.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Render a template string with {{variable}} placeholders. */
export function renderTemplate(
  template: string,
  vars: AutomationVariables,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? "";
  });
}

/** Build the variable map for a booking row. Async because the
 * `{{terms}}` block is fetched from the live admin-editable terms. */
export async function variablesForBooking(args: {
  clientName: string;
  service: string;
  date: Date;
  time: string;
  duration: string;
  pricePence: number;
  depositPence?: number;
  /** All appointments in this booking (a block has 2-5). Defaults to the
   * single date/time above. */
  sessions?: Array<{ date: Date; time: string }>;
}): Promise<AutomationVariables> {
  const meta = await bookingServiceMetaFromDb(args.service);
  const dateStr = args.date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });

  // `mode` is the reliable online/in-person flag (the meta helper only
  // guesses from the tagline text), and we need the real duration for the
  // calendar link's end time.
  const svc = await prisma.bookingService.findUnique({
    where: { slug: args.service },
    select: { mode: true, durationMinutes: true },
  });
  const isOnline = svc?.mode === "online";

  // Every appointment in the booking. A block lists each session so the
  // parent sees all the dates they've just booked.
  const all = args.sessions?.length
    ? args.sessions
    : [{ date: args.date, time: args.time }];
  const longDate = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/London",
    });
  const sessionsHtml =
    all.length === 1
      ? `<ul>
  <li><strong>Date:</strong> ${longDate(all[0].date)}</li>
  <li><strong>Time:</strong> ${all[0].time}</li>
</ul>`
      : `<p><strong>Your ${all.length} appointments:</strong></p>
<ul>
${all
  .map(
    (s, i) =>
      `  <li>Session ${i + 1} of ${all.length} — ${longDate(s.date)} at ${s.time}</li>`,
  )
  .join("\n")}
</ul>`;

  return {
    client_name: args.clientName,
    service: meta.title,
    date: dateStr,
    time: args.time,
    duration: args.duration,
    price: formatPrice(args.pricePence),
    deposit: args.depositPence ? formatPrice(args.depositPence) : "",
    terms: await renderTermsHtmlFromDb(args.service),
    sessions: sessionsHtml,
    calendar_link: buildCalendarLink({
      title: meta.title,
      date: args.date,
      time: args.time,
      durationMinutes: svc?.durationMinutes ?? 60,
    }),
    // Online services only — an in-person clinic must not be told a video
    // link is coming.
    online_note: isOnline
      ? "We will send the video link separately closer to the time. Please find a quiet space with a good internet connection and have your child nearby if relevant."
      : "",
  };
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

/**
 * Get an automation by key, or `null` if it doesn't exist or is disabled.
 * Send sites should always go through this — never query the table directly
 * — so disabled automations are respected uniformly.
 */
export async function getEnabledAutomation(key: string) {
  const row = await prisma.bookingAutomation.findUnique({ where: { key } });
  if (!row || !row.enabled) return null;
  return row;
}

/** Default copy for the two seeded automations. Used by ensureDefaults() and
 * exposed for the "reset to default" button in the admin UI. */
export const DEFAULT_AUTOMATIONS = {
  confirmation: {
    key: "confirmation",
    label: "Booking confirmation",
    description:
      "Sent immediately when a client books a session. Includes the booking details and the T&Cs they agreed to.",
    triggerType: "on_booking" as const,
    triggerHoursBefore: null as number | null,
    subject: "Your booking with The Sensory Submarine is confirmed",
    bodyHtml: `<h2>Your booking is confirmed</h2>
<p>Hi {{client_name}}, thanks for booking with The Sensory Submarine. Here's a reminder of your upcoming appointment(s).</p>
<h3>Booking details</h3>
<ul>
  <li><strong>Service:</strong> {{service}}</li>
  <li><strong>Date:</strong> {{date}}</li>
  <li><strong>Time:</strong> {{time}}</li>
  <li><strong>Total:</strong> {{price}}</li>
</ul>
<p><a href="{{calendar_link}}">Click here to add to your calendar</a></p>
<p>We are looking forward to seeing you soon.</p>
<p><strong>The Sensory Submarine</strong></p>
<p><img src="https://portal.thesensorysubmarine.com/brand/logo.jpg" alt="The Sensory Submarine" width="110" style="display:block;border:0;" /></p>
{{terms}}
<p>If you need to cancel or reschedule, please email <a href="mailto:admin@thesensorysubmarine.com">admin@thesensorysubmarine.com</a> as soon as possible. Cancellation charges may apply as per the terms above.</p>`,
  },
  reminder_24h: {
    key: "reminder_24h",
    label: "24-hour reminder",
    description:
      "Sent the morning before the appointment to anyone whose session is the next day.",
    triggerType: "before_appointment" as const,
    triggerHoursBefore: 24 as number | null,
    subject: "Reminder: your appointment with The Sensory Submarine is tomorrow at {{time}}",
    // {{online_note}} resolves to the video-link line for online services
    // and to an empty string for in-person clinics.
    bodyHtml: `<h2>Reminder: your appointment is tomorrow</h2>
<p>Hi {{client_name}}, this is a friendly reminder of your appointment with The Sensory Submarine.</p>
<h3>Appointment details</h3>
<ul>
  <li><strong>Service:</strong> {{service}}</li>
  <li><strong>Date:</strong> {{date}}</li>
  <li><strong>Time:</strong> {{time}} (UK time)</li>
  <li><strong>Duration:</strong> {{duration}}</li>
</ul>
<p>{{online_note}}</p>
<p>We're looking forward to seeing you then!</p>
<p><strong>The Sensory Submarine</strong></p>
<p><img src="https://portal.thesensorysubmarine.com/brand/logo.jpg" alt="The Sensory Submarine" width="110" style="display:block;border:0;" /></p>
<p>Need to cancel or reschedule? Contact <a href="mailto:admin@thesensorysubmarine.com">admin@thesensorysubmarine.com</a> as soon as possible. Cancellations within 24 hours of the appointment require full payment.</p>`,
  },
};

/**
 * Idempotently create the two default automations if they don't already
 * exist. Called from the admin UI on mount so a fresh DB picks them up
 * automatically. Doesn't touch existing rows — Patrick's edits are safe.
 */
export async function ensureDefaultAutomations() {
  for (const def of Object.values(DEFAULT_AUTOMATIONS)) {
    await prisma.bookingAutomation.upsert({
      where: { key: def.key },
      update: {}, // intentionally don't overwrite — preserve user edits
      create: {
        key: def.key,
        label: def.label,
        description: def.description,
        triggerType: def.triggerType,
        triggerHoursBefore: def.triggerHoursBefore,
        subject: def.subject,
        bodyHtml: def.bodyHtml,
        enabled: true,
        isDefault: true,
      },
    });
  }
}
