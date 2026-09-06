/**
 * How the public booking page arranges the service catalogue.
 *
 * Two ideas live here so /book and the per-service landing page agree:
 *
 * 1. LOCATION GROUPS. Some services exist once per clinic — "OT Assessment
 *    — Armagh", "OT Assessment — Antrim" — each run by that clinic's
 *    therapist. The public page shows ONE card for the group, then a
 *    location step where the parent picks the clinic and sees who they'd
 *    be seeing. The group is read off the title: everything before the
 *    dash. Grace asked for the Block of OT to work the same way as the
 *    assessment, so the grouping is by title rather than a hard-coded
 *    "assessment" special case — a new "Something — Town" service groups
 *    itself.
 *
 * 2. ENQUIRY SERVICES. Schools & community work (sensory play sessions,
 *    bespoke training, small groups) is arranged around whatever Grace
 *    already has in the diary, so those aren't booked against the
 *    calendar at all. Their card says "Enquire now" and opens the enquiry
 *    form, which emails the admin inbox.
 */

/** Public slug of the Form that takes schools & community enquiries. */
export const ENQUIRY_FORM_SLUG = "schools-enquiry";

/** Services in this category are enquired about, not booked. */
export function isEnquiryCategory(category: string | null | undefined): boolean {
  return (category ?? "").trim().toLowerCase().startsWith("schools");
}

/** Link into the enquiry form with the service pre-selected. */
export function enquiryHref(serviceTitle: string): string {
  return `/f/${ENQUIRY_FORM_SLUG}?service=${encodeURIComponent(serviceTitle)}`;
}

/**
 * The group a per-location service belongs to, or null for a service
 * that stands on its own. Only in-person services tagged with a town
 * count; "OT Assessment — Armagh" → "OT Assessment".
 */
export function locationGroupKey(s: {
  title: string;
  mode: string;
  locationLabel: string | null;
}): string | null {
  if (s.mode !== "in_person" || !s.locationLabel) return null;
  const stem = s.title.split(/\s+[—–-]\s+/)[0]?.trim();
  return stem || s.title.trim();
}

export interface GroupMeta {
  /** Card and step heading. */
  title: string;
  /** Small uppercase badge on the card. */
  badge: string;
  /** One or two sentences under the title. */
  blurb: string;
}

/**
 * Copy for the groups we know about. Anything else falls back to the
 * title stem and the first service's tagline, so a new group still reads
 * sensibly before anyone writes copy for it.
 */
const GROUP_META: Record<string, GroupMeta> = {
  "OT Assessment": {
    title: "Face to Face OT Assessment",
    badge: "Most requested",
    blurb:
      "A full in-person occupational therapy assessment. Choose the clinic nearest you to see available dates.",
  },
  "Block of Occupational Therapy": {
    title: "Block of Occupational Therapy",
    badge: "Targeted therapy",
    blurb:
      "Hands-on therapy sessions, booked as a block of one to five. Choose the clinic nearest you to see your therapist and available dates.",
  },
};

export function groupMeta(key: string, fallbackTagline?: string | null): GroupMeta {
  return (
    GROUP_META[key] ?? {
      title: key,
      badge: "In person",
      blurb:
        fallbackTagline?.trim() ||
        "Choose the clinic nearest you to see available dates.",
    }
  );
}
