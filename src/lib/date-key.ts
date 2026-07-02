/**
 * Local calendar-day key, "YYYY-MM-DD".
 *
 * Availability is generated and keyed by CALENDAR DATE (e.g. the row for
 * "2026-06-23" is that date's — a Tuesday's — schedule). The booking
 * calendars build their day cells as LOCAL midnight Dates, so keying a
 * lookup with `date.toISOString()` shifts to the previous UTC day in any
 * positive-offset timezone (e.g. UK summer time, BST = UTC+1) — which made
 * Tuesday's availability appear on Wednesday, Thursday's on Friday.
 *
 * Using local Y/M/D keeps the key on the same calendar day the user sees,
 * matching the server's date keys and killing the off-by-one.
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
