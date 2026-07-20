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

/**
 * Calendar-day key ("YYYY-MM-DD") for an instant AS SEEN IN LONDON.
 *
 * Booking `date` values are stored as the London calendar day's midnight,
 * which during BST is 23:00 UTC the night before (e.g. a 23 July booking is
 * stored "2026-07-22T23:00:00Z"). Matching those with the viewer's LOCAL
 * calendar day is correct in the UK but drifts a day in other timezones.
 * Keying the booking by its Europe/London day — and comparing against the
 * grid cell's `localDateKey` — pins it to the day staff actually intend, in
 * ANY viewer timezone. `en-CA` formats as YYYY-MM-DD with no manual parsing.
 */
export function londonDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
