/**
 * "How to check this" walkthroughs on build tasks.
 *
 * Grace and Claire log the requests but aren't technical, so a task moving to
 * For Review used to mean reading a wall of text and hunting for the change
 * themselves. A review guide is an ordered list of steps — a screenshot, a
 * short plain-English caption, and optionally a direct link to the page —
 * so they can see the update, click straight to it, and say whether it's
 * what they wanted.
 *
 * Stored on `Task.reviewGuide` as Json; always read/written whole.
 */

export interface ReviewGuideStep {
  /** Screenshot of the change (Vercel Blob URL). Optional — a step can be
   * text + link only, e.g. "click Save and you should see…". */
  imageUrl: string;
  /** Short step heading, e.g. "Open Training in the menu". */
  title: string;
  /** Plain-English explanation of what to look at. */
  caption: string;
  /** Optional deep link to the exact page being described. */
  href: string;
  /** Label for the link button, e.g. "Open the Training page". */
  hrefLabel: string;
}

const MAX_STEPS = 12;

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/** Only allow http(s) / app-relative links. */
function safeHref(raw: unknown): string {
  const t = str(raw, 500);
  if (!t) return "";
  if (t.startsWith("/")) return t; // in-app route
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Coerce arbitrary Json into a clean, capped list of steps. */
export function cleanReviewGuide(raw: unknown): ReviewGuideStep[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewGuideStep[] = [];
  for (const item of raw.slice(0, MAX_STEPS)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = str(o.title, 160);
    const caption = str(o.caption, 800);
    const imageUrl = safeHref(o.imageUrl);
    // A step with nothing to show or say is noise.
    if (!title && !caption && !imageUrl) continue;
    out.push({
      imageUrl,
      title,
      caption,
      href: safeHref(o.href),
      hrefLabel: str(o.hrefLabel, 60) || "Open this page",
    });
  }
  return out;
}
