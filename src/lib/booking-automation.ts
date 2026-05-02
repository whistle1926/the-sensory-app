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
import { renderTermsHtml } from "@/lib/booking-terms";
import { bookingServiceMeta } from "@/lib/booking-services";

export interface AutomationVariables {
  client_name: string;
  service: string;
  date: string;
  time: string;
  duration?: string;
  price?: string;
  deposit?: string;
  terms?: string; // raw HTML
  [key: string]: string | undefined;
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

/** Build the variable map for a booking row (DB row, not the API body). */
export function variablesForBooking(args: {
  clientName: string;
  service: string;
  date: Date;
  time: string;
  duration: string;
  pricePence: number;
  depositPence?: number;
}): AutomationVariables {
  const meta = bookingServiceMeta(args.service);
  const dateStr = args.date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  return {
    client_name: args.clientName,
    service: meta.title,
    date: dateStr,
    time: args.time,
    duration: args.duration,
    price: formatPrice(args.pricePence),
    deposit: args.depositPence ? formatPrice(args.depositPence) : "",
    terms: renderTermsHtml(args.service),
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
    bodyHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
  <h1 style="font-size:20px;margin:0 0 8px 0">Your booking is confirmed</h1>
  <p style="font-size:14px;color:#475569;margin:0 0 20px 0">
    Hi {{client_name}}, thanks for booking with The Sensory Submarine.
  </p>
  <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC">
    <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.04em">Booking details</p>
    <p style="margin:0;font-size:14px;line-height:1.7">
      <strong>Service:</strong> {{service}}<br/>
      <strong>Date:</strong> {{date}}<br/>
      <strong>Time:</strong> {{time}}<br/>
      <strong>Total:</strong> {{price}}
    </p>
  </div>
  {{terms}}
  <p style="font-size:12px;color:#94A3B8;margin-top:24px">
    If you need to cancel or reschedule, please reply to this email as soon as possible.
    Cancellation charges apply per the terms above.
  </p>
</div>`,
  },
  reminder_24h: {
    key: "reminder_24h",
    label: "24-hour reminder",
    description:
      "Sent the morning before the appointment to anyone whose session is the next day.",
    triggerType: "before_appointment" as const,
    triggerHoursBefore: 24 as number | null,
    subject: "Reminder: your appointment with The Sensory Submarine is tomorrow at {{time}}",
    bodyHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
  <h1 style="font-size:20px;margin:0 0 8px 0">Reminder: your appointment is tomorrow</h1>
  <p style="font-size:14px;color:#475569;margin:0 0 20px 0">
    Hi {{client_name}}, this is a friendly reminder of your appointment with The Sensory Submarine.
  </p>
  <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC">
    <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.04em">Appointment details</p>
    <p style="margin:0;font-size:14px;line-height:1.7">
      <strong>Service:</strong> {{service}}<br/>
      <strong>Date:</strong> {{date}}<br/>
      <strong>Time:</strong> {{time}} (UK time)<br/>
      <strong>Duration:</strong> {{duration}}
    </p>
  </div>
  <p style="font-size:13px;color:#475569;margin-top:20px;line-height:1.55">
    We'll send the video link separately closer to the time. Please find a quiet space with a good internet connection and have your child nearby if relevant.
  </p>
  <p style="font-size:12px;color:#94A3B8;margin-top:24px">
    Need to cancel or reschedule? Reply to this email as soon as possible. Cancellations within 24 hours of the appointment require full payment unless in case of sickness.
  </p>
</div>`,
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
