/**
 * Partner-course promo card shown on the parent training portal.
 *
 * Some of the training Patrick's businesses offer isn't hosted in this app —
 * The Little Sensory Explorers CPD course is a partnership, sold on its own
 * site. Rather than hard-coding a link, the card's copy lives in
 * `StorefrontConfig.partnerCourse` so Grace can edit the blurb, price and
 * URL from Settings without a developer.
 */

export interface PartnerCourse {
  enabled: boolean;
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
  price: string;
  url: string;
  ctaLabel: string;
}

const MAX_BULLETS = 6;

/** Sensible starting content — the Little Sensory Explorers CPD course. */
export const DEFAULT_PARTNER_COURSE: PartnerCourse = {
  enabled: false,
  eyebrow: "In partnership",
  title: "CPD Accredited Sensory Play Practitioner Training",
  blurb:
    "Our sister course from The Little Sensory Explorers — a flexible, self-paced training for parents, teachers and early years providers who want to understand sensory play properly, or run their own sensory play sessions. Created by Grace Magennis and Simran McDaid.",
  bullets: [
    "20 hours of learning across 66 lessons",
    "CPD certificate on completion",
    "Lifetime access, work at your own pace",
    "Includes a business set-up module",
  ],
  price: "£360",
  url: "https://www.thelittlesensoryexplorers.co.uk",
  ctaLabel: "Find out more",
};

/** Only allow http(s) links — never javascript:/data: from admin input. */
function safeUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";
  // Accept a bare domain (as an admin would naturally type it) by
  // defaulting to https rather than rejecting it.
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/** Coerce arbitrary JSON from the DB / request body into a clean card. */
export function cleanPartnerCourse(raw: unknown): PartnerCourse {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bullets = Array.isArray(o.bullets)
    ? o.bullets
        .map((b) => str(b, 120))
        .filter(Boolean)
        .slice(0, MAX_BULLETS)
    : [];
  return {
    enabled: o.enabled === true,
    eyebrow: str(o.eyebrow, 60),
    title: str(o.title, 160),
    blurb: str(o.blurb, 1_000),
    bullets,
    price: str(o.price, 40),
    url: safeUrl(o.url),
    ctaLabel: str(o.ctaLabel, 40) || "Find out more",
  };
}

/** True when there's enough to render a meaningful card. */
export function partnerCourseIsVisible(c: PartnerCourse): boolean {
  return c.enabled && !!c.title && !!c.url;
}
