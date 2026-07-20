/**
 * Page help registry — the single source of truth for the little "?"
 * guides that appear next to each page title.
 *
 * WHY THIS FILE EXISTS
 * Non-technical staff need to know how to use each page, and the
 * guidance must stay current as features change. Keeping every page's
 * help here (rather than scattered across components) means updating a
 * guide is a one-line edit in one place — and it's obvious where to do
 * it when a feature ships.
 *
 * HOW TO USE
 *   • Add or edit an entry below, keyed by a short `pageKey`.
 *   • Drop `<PageHelp pageKey="..." />` into that page's header, or pass
 *     `help="..."` to the shared <Toolbar>.
 *
 * WHEN YOU CHANGE A PAGE, UPDATE ITS ENTRY HERE so the on-screen guide
 * always matches what the page actually does.
 */

/**
 * A step. Either plain text, or text plus a `target` CSS selector for the
 * element it's talking about — the guide then highlights and scrolls to it
 * as you step through.
 *
 * Targets should point at a data-help attribute on the page rather than a
 * class or DOM shape, so restyling can't silently break them — e.g. a step
 * targeting the Availability tab uses the selector
 * [data-help="bookings-tab-availability"], and the tab button carries the
 * matching attribute.
 *
 * If the element isn't on screen the step just shows without a highlight,
 * so a stale selector degrades quietly rather than breaking the guide. That
 * also means a renamed attribute fails SILENTLY — when you move or rename a
 * targeted element, update its step here too.
 */
export type PageHelpStep = string | { text: string; target?: string };

export interface PageHelpContent {
  /** Heading shown at the top of the help panel. */
  title: string;
  /** One sentence: what this page is for. */
  summary: string;
  /** Short, ordered "how to use it" steps — keep each to one line. */
  steps: PageHelpStep[];
  /** Optional extra pointers (shortcuts, gotchas, good-to-knows). */
  tips?: string[];
}

/** Normalise a step to its object form. */
export function stepParts(step: PageHelpStep): { text: string; target?: string } {
  return typeof step === "string" ? { text: step } : step;
}

export const PAGE_HELP: Record<string, PageHelpContent> = {
  dashboard: {
    title: "Your dashboard",
    summary:
      "A live overview of the practice — revenue, bookings, reports and clients, all from real data.",
    steps: [
      "Use the Today / Week / Month / Quarter buttons to change the period every figure is measured over.",
      "The revenue chart's 14 / 30 / 90-day toggle changes how far back the graph looks.",
      "Revenue and ‘received’ figures come from your real Fire payments and refresh automatically each day.",
    ],
    tips: [
      "Numbers self-correct overnight, so if a payment lands late it’ll appear the next day.",
    ],
  },

  bookings: {
    title: "Managing bookings",
    summary:
      "One place to see your calendar, set when each service is available, and manage what clients can book.",
    steps: [
      {
        text: "Calendar — opens on the month view, showing your portal bookings and your Google Calendar together. Click any day to see its hour-by-hour timeline, or use Month/Day (top right) to switch. A dot under a date means something's on.",
        target: '[data-help="bookings-tab-calendar"]',
      },
      {
        text: "New booking (top right) — book a client in yourself. Pick the service and the price fills in automatically.",
        target: '[data-help="bookings-new"]',
      },
      {
        text: "Availability — choose a service from the dropdown, then set its weekly hours. Each block of hours you add is ONE bookable appointment, so 09:15–10:00 offers a 09:15 slot. Add more blocks to offer more times.",
        target: '[data-help="bookings-tab-availability"]',
      },
      {
        text: "For a monthly clinic, skip weekly hours and add date-specific days instead (Date overrides → pick the date → Custom hours).",
        target: '[data-help="bookings-tab-availability"]',
      },
      {
        text: "Services — add, edit or hide what people can book: price, location, who runs it, and Sessions per booking (leave 1–1 for a single appointment, or set 2–5 for a block where the client picks several dates and pays per session). LIVE/OFF makes a service public or hidden.",
        target: '[data-help="bookings-tab-services"]',
      },
      {
        text: "Automations — edit the confirmation and 24-hour reminder emails clients receive.",
        target: '[data-help="bookings-tab-automations"]',
      },
      {
        text: "Terms — edit the terms & conditions clients tick when booking.",
        target: '[data-help="bookings-tab-terms"]',
      },
      {
        text: "Share this booking link with clients so they can book themselves.",
        target: '[data-help="bookings-share-link"]',
      },
    ],
    tips: [
      "To add a clinic location: Services → New service, set its Location and who runs it, add its dates under Availability, then switch it LIVE.",
      "Google Calendar events show here as read-only (tagged “Google”) — edit those in Google. Only portal bookings can be changed here.",
      "Portal bookings don’t appear in Google automatically. When a booking is made, the therapist (or the practice inbox for unassigned services) gets a “New booking” email with a one-click ‘Add to Google Calendar’ button — that’s how it gets into your Google diary.",
      "Share the booking link at the top with clients so they can book themselves.",
    ],
  },

  services: {
    title: "Booking services",
    summary:
      "The catalogue of everything clients can book — consultations, assessments and clinic locations.",
    steps: [
      "New service adds a bookable item; Edit opens its details (title, price, duration, location, owner).",
      "Set a Location name on an in-person assessment and it appears as a location tab on the booking page automatically.",
      "Use the LIVE / OFF switch to publish or hide a service; Delete removes one with no bookings (otherwise switch it off).",
      "Add a therapist inline while editing — their login is created and they’re assigned as the owner.",
    ],
  },

  forms: {
    title: "Forms & questionnaires",
    summary:
      "Build intake forms, consent forms and surveys, then share them or email them to clients.",
    steps: [
      "New Form opens the builder; add your questions and Publish when ready.",
      "Copy link shares the public form; Send emails it directly to specific clients.",
      "Click a form’s ‘X sent’ to see exactly who it went to and whether they’ve opened or completed it.",
      "Entries shows every response; open one to read, print or forward it.",
    ],
    tips: [
      "Set who gets notified when a form is completed in the builder’s ‘Staff notification’ box.",
    ],
  },

  invoices: {
    title: "Invoices",
    summary:
      "Create, send and track invoices. Fire is the source of truth for what’s actually been paid.",
    steps: [
      "Create an invoice and choose the client. Pick a service on a line item and its description and price fill in for you — you can still edit either.",
      "Use the Travel expenses and Discount buttons for extra lines. For a discount, type the amount as a negative (e.g. -25) so it comes off the total.",
      "The due date defaults to the day you issue it. Use the ‘30 days (schools)’ button for school/EA terms.",
      "Send the invoice by email, or use Download / Print on any invoice for a clean PDF copy (for your records, an accountant, or a finance team).",
      "If an email doesn’t land, Copy payment link or WhatsApp link get the payment link to the client another way.",
      "‘Received’ badges and the Payments received view come from real Fire transactions — never set by hand.",
    ],
  },

  clients: {
    title: "Clients",
    summary: "Every child/family record, with their reports, forms and home programmes in one place.",
    steps: [
      "Open a client to see their overview, assessments, forms and home programmes.",
      "Use the panels on the client page to start a report, send a form, or build a home programme for them.",
    ],
  },

  reports: {
    title: "Reports",
    summary: "Turn session notes into a structured OT report you can review, export and send.",
    steps: [
      "Start a report from a client, paste or dictate your session notes, and let the draft generate.",
      "Edit any section, reorder them, and use Tidy with AI to clean up the writing — you review the before/after first, and you can edit the AI's ‘After’ text yourself before applying.",
      "Word downloads a .docx. PDF opens a clean copy and brings up the print box — choose ‘Save as PDF’.",
      "Email sends the report to the parent. Use Add attachment there to include extras like a visual schedule.",
    ],
  },
};

/** Safe lookup — returns null for an unknown key so the icon simply
 * doesn’t render rather than throwing. */
export function getPageHelp(pageKey: string): PageHelpContent | null {
  return PAGE_HELP[pageKey] ?? null;
}
