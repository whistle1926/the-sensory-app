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

export interface PageHelpContent {
  /** Heading shown at the top of the help popover. */
  title: string;
  /** One sentence: what this page is for. */
  summary: string;
  /** Short, ordered "how to use it" steps — keep each to one line. */
  steps: string[];
  /** Optional extra pointers (shortcuts, gotchas, good-to-knows). */
  tips?: string[];
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
      "Calendar — see upcoming bookings. Use New booking (top right) to add one yourself for a client.",
      "Availability — pick a service from the dropdown, then set its weekly hours, or add date-specific clinic days for monthly clinics.",
      "Services — add, edit or hide the things people can book (price, location, who runs it). The LIVE/OFF switch makes a service public or hidden.",
      "Automations — edit the confirmation and reminder emails clients receive.",
      "Terms — edit the terms & conditions clients tick when booking.",
    ],
    tips: [
      "To add a new clinic location: Services → New service, set its Location and owner, set its dates under Availability, then switch it LIVE.",
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
      "Create and track invoices. Fire is the source of truth for what’s actually been paid.",
    steps: [
      "Create an invoice, choose the client and add line items (the service picker fills in price and tax).",
      "‘Received’ badges and the Payments received view come from real Fire transactions — not set by hand.",
      "Use the filters to see what’s outstanding versus received.",
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
      "Edit any section, reorder them, then save.",
      "Export to PDF/Word or send a branded summary email to the parent.",
    ],
  },
};

/** Safe lookup — returns null for an unknown key so the icon simply
 * doesn’t render rather than throwing. */
export function getPageHelp(pageKey: string): PageHelpContent | null {
  return PAGE_HELP[pageKey] ?? null;
}
