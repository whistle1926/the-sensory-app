/**
 * UTM capture + retrieval — client-side helpers.
 *
 * The flow:
 *  1. Visitor lands on any page with `?utm_source=...&utm_campaign=...`
 *     in the URL (or `?gclid=` / `?fbclid=` from Google / Meta).
 *  2. <UtmCapture> on first load reads the params and stashes a tagged
 *     bundle in sessionStorage under STORAGE_KEY.
 *  3. Any later page in the same visit (e.g. /courses → /courses/x →
 *     checkout) calls `readStoredUtms()` to attach the bundle to the
 *     order body. Persists across the whole visit but not across
 *     browser sessions — matches how every analytics platform attributes.
 *
 * If the visitor lands without UTMs, we still capture the document
 * referrer so direct/organic visits can be told apart from typed-in.
 */
export const STORAGE_KEY = "tsubmarine.utm.v1";

export interface CapturedUtms {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** Click-id from Google Ads ($gclid) — useful for offline conversion. */
  gclid?: string;
  /** Click-id from Meta Ads ($fbclid). */
  fbclid?: string;
  /** Document referrer at the moment of capture. */
  referrer?: string;
  /** ISO timestamp of capture — handy for debugging stale data. */
  capturedAt?: string;
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Pull UTMs out of a URL query string. */
export function parseUtms(search: string): CapturedUtms {
  const params = new URLSearchParams(search);
  const out: CapturedUtms = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) {
      // utm_source → utmSource, utm_campaign → utmCampaign, etc.
      // Earlier version stripped the underscore first, leaving "utmsource"
      // which didn't match the DB column names — breaking attribution
      // end-to-end.
      const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      (out as Record<string, string>)[camel] = v.slice(0, 200);
    }
  }
  const gclid = params.get("gclid");
  const fbclid = params.get("fbclid");
  if (gclid) out.gclid = gclid.slice(0, 200);
  if (fbclid) out.fbclid = fbclid.slice(0, 200);
  return out;
}

/** Read previously-stashed UTMs from sessionStorage. */
export function readStoredUtms(): CapturedUtms | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CapturedUtms;
  } catch {
    return null;
  }
}

/** Persist a fresh UTM bundle, but only if it has any actual data — we
 * don't want to overwrite a previous "?utm_source=meta" capture with
 * an empty one when the user navigates within the site. */
export function storeUtms(utms: CapturedUtms): void {
  if (typeof window === "undefined") return;
  const hasData =
    utms.utmSource ||
    utms.utmCampaign ||
    utms.utmMedium ||
    utms.gclid ||
    utms.fbclid;
  if (!hasData && readStoredUtms()) return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...utms,
        referrer: utms.referrer ?? document.referrer ?? "",
        capturedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* sessionStorage disabled / quota exceeded — non-fatal */
  }
}
