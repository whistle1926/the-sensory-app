/**
 * How long a booking lasts, in minutes: the service's set length, else read
 * from the booking's duration label ("1 hour", "45 minutes"), else an hour.
 */
export function bookingMinutes(
  serviceMinutes: number | null | undefined,
  label: string,
): number {
  if (serviceMinutes && serviceMinutes > 0) return serviceMinutes;
  const hr = label.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/i);
  if (hr) return Math.round(parseFloat(hr[1]) * 60);
  const min = label.match(/(\d+)\s*min/i);
  if (min) return parseInt(min[1], 10);
  return 60;
}

/**
 * The UK calendar day a booking is on, as YYYY-MM-DD. `Booking.date` is
 * stored as UK midnight (23:00Z in summer) or, on older rows, UTC midnight;
 * snapping by +12h lands on the intended day either way.
 */
export function bookingDayKey(date: Date): string {
  return new Date(date.getTime() + 12 * 3_600_000).toISOString().slice(0, 10);
}
