/**
 * Service-scoped availability / slot generation.
 *
 * Background: bookings used to run off a single global calendar
 * (WeeklyHours + DateOverride rows with no service link). We've since
 * scoped those rows by `serviceId` so each bookable service can have
 * its own days/times, and each service can be owned by an associate.
 *
 * The two rules that make this behave intuitively:
 *
 *  1. **Custom vs default.** A service is "custom" the moment it has
 *     ANY weekly rows or ANY date overrides of its own — then it uses
 *     only its own calendar. Until then it inherits the legacy global
 *     calendar (serviceId = NULL), so existing services keep working
 *     untouched.
 *
 *  2. **Double-booking is per-owner, not per-service.** When we remove
 *     already-booked times we look at every booking belonging to the
 *     service's OWNER (across all their services), so an associate
 *     can't be booked for an Armagh clinic and a home visit at the
 *     same moment. Unassigned services (owner = NULL) share the
 *     practice calendar, matching the old single-practitioner model.
 *     A booking blocks every slot it OVERLAPS (start + its length), not
 *     just the same start time.
 *
 *  3. **Time off is per-person, not per-service.** A StaffTimeOff row
 *     takes whole days out of every service its person owns, so a week
 *     off is set once, not once per service (Grace, Sept 2026).
 */
import { prisma } from "@/lib/prisma";
import { listUpcomingEvents } from "@/lib/google-calendar";
import { bookingDayKey, bookingMinutes } from "@/lib/booking-duration";

export interface Interval {
  start: string;
  end: string;
}

/** "HH:MM" → minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutes since midnight → "HH:MM" (capped at 23:59). */
function fromMinutes(min: number): string {
  const m = Math.min(Math.max(0, min), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Drop any appointment slot that clashes with a blocked window.
 *
 * Slots aren't split, they're removed: one interval IS one appointment here
 * (see slotsFromIntervals), so half of a 45-minute assessment is no use to
 * anyone. Blocking 14:00–16:00 on a day of 45-minute blocks therefore takes
 * out the ones that overlap and leaves the rest of the day alone.
 */
export function withoutBlocked(
  intervals: Interval[],
  blocked: Interval[],
): Interval[] {
  if (!blocked.length) return intervals;
  const windows = blocked
    .filter((b) => b?.start && b?.end)
    .map((b) => [toMinutes(b.start), toMinutes(b.end)] as const);
  return intervals.filter((iv) => {
    if (!iv?.start || !iv?.end) return false;
    const s = toMinutes(iv.start);
    const e = toMinutes(iv.end);
    // Overlap if the appointment starts before the block ends and ends
    // after it begins. Touching edges (10:00 end vs 10:00 block) is fine.
    return !windows.some(([bs, be]) => s < be && e > bs);
  });
}

export interface AvailabilityScope {
  /** BookingService.id to scope to, or null for the global default calendar. */
  serviceId: string | null;
  /** Owner whose existing bookings block slots, or null for the practice. */
  ownerId: string | null;
}

/**
 * Turn configured availability intervals into bookable slot start-times.
 *
 * ONE SLOT PER INTERVAL — each interval is a discrete appointment slot, so
 * "09:15–10:00" offers exactly one bookable time: 09:15. This is the
 * TidyCal model Grace asked for (2026-07-17) and it matches how the hours
 * are actually configured: 45-minute blocks separated by 15-minute gaps.
 *
 * Previously we stepped *inside* each interval every 30 minutes, which
 * offered two starts in one 45-minute block (09:15 AND 09:45). Since
 * nothing here checks appointment length, that let a 60-minute assessment
 * booked at 09:45 run straight over the following block. One-slot-per-
 * interval removes that whole class of overlap: the interval defines the
 * appointment, so the therapist controls the spacing via their hours.
 *
 * To offer more times, add more intervals in Bookings → Availability.
 */
export function slotsFromIntervals(intervals: Interval[]): string[] {
  const slots: string[] = [];
  for (const iv of intervals) {
    if (!iv?.start || !iv?.end) continue;
    const [sh, sm] = iv.start.split(":").map(Number);
    const [eh, em] = iv.end.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) continue;
    // Ignore zero/negative-length intervals.
    if (eh * 60 + em <= sh * 60 + sm) continue;
    slots.push(
      `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`,
    );
  }
  // De-dupe + sort so overlapping/duplicate intervals can't double-list a
  // time and the grid always reads in order.
  return Array.from(new Set(slots)).sort();
}

/** ISO date key (YYYY-MM-DD) in UTC, matching how dates are stored. */
function dateKeyOf(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Load the effective weekly schedule + overrides for a service,
 * applying the custom-vs-default fallback described above.
 */
async function loadSchedule(
  serviceId: string | null,
  from: Date,
  to: Date,
): Promise<{
  weekly: Record<number, { enabled: boolean; intervals: Interval[] }>;
  overrideMap: Record<
    string,
    { available: boolean; intervals: Interval[] | null; blocked: Interval[] | null }
  >;
}> {
  let weeklyRows = await prisma.weeklyHours.findMany({ where: { serviceId } });
  let overrideRows = await prisma.dateOverride.findMany({
    where: { serviceId, date: { gte: from, lte: to } },
  });

  // For a real service (non-null) with no calendar of its own, inherit
  // the global default rows so it behaves exactly as before.
  if (serviceId !== null && weeklyRows.length === 0 && overrideRows.length === 0) {
    weeklyRows = await prisma.weeklyHours.findMany({ where: { serviceId: null } });
    overrideRows = await prisma.dateOverride.findMany({
      where: { serviceId: null, date: { gte: from, lte: to } },
    });
  }

  const weekly: Record<number, { enabled: boolean; intervals: Interval[] }> = {};
  for (const row of weeklyRows) {
    weekly[row.dayOfWeek] = {
      enabled: row.enabled,
      intervals: row.intervals as unknown as Interval[],
    };
  }

  const overrideMap: Record<
    string,
    { available: boolean; intervals: Interval[] | null; blocked: Interval[] | null }
  > = {};
  for (const o of overrideRows) {
    overrideMap[dateKeyOf(o.date)] = {
      available: o.available,
      intervals: o.intervals as unknown as Interval[] | null,
      blocked: o.blockedIntervals as unknown as Interval[] | null,
    };
  }

  return { weekly, overrideMap };
}

/**
 * Compute a { "YYYY-MM-DD": ["09:00", "09:30", ...] } map of free slots
 * for the given service over [from, to].
 */
export async function computeAvailability(
  from: Date,
  to: Date,
  scope: AvailabilityScope,
): Promise<Record<string, string[]>> {
  const { weekly, overrideMap } = await loadSchedule(scope.serviceId, from, to);

  // Booked times for this owner across ALL their services in range.
  // ownerId null → the practice's legacy bookings (also ownerId null).
  // Widened a day each side: dates are stored as UK midnight (23:00Z in
  // summer), so the first day's bookings sit just before `from`.
  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: new Date(from.getTime() - 864e5), lte: new Date(to.getTime() + 864e5) },
      status: { not: "cancelled" },
      ownerId: scope.ownerId,
    },
    select: { date: true, time: true, duration: true, service: true },
  });
  const serviceMinutes = new Map(
    (
      await prisma.bookingService.findMany({ select: { slug: true, durationMinutes: true } })
    ).map((s) => [s.slug, s.durationMinutes]),
  );
  // Each booking as a busy window on its UK day.
  const bookedWindows: Record<string, Interval[]> = {};
  for (const b of bookings) {
    const start = toMinutes(b.time);
    const end = start + bookingMinutes(serviceMinutes.get(b.service), b.duration);
    (bookedWindows[bookingDayKey(b.date)] ??= []).push({ start: fromMinutes(start), end: fromMinutes(end) });
  }

  // Whole days off for this person (or the practice, for unowned services).
  const timeOff = await prisma.staffTimeOff.findMany({
    where: { userId: scope.ownerId, startDate: { lte: to }, endDate: { gte: from } },
    select: { startDate: true, endDate: true },
  });
  const isOff = (dateKey: string) =>
    timeOff.some(
      (t) => dateKeyOf(t.startDate) <= dateKey && dateKeyOf(t.endDate) >= dateKey,
    );
  // What's already in the owner's own Google diary. A portal booking blocks
  // its slot, but until now anything Grace put in Google herself did not —
  // so a client could book a time she was already teaching. Read-only, and
  // deliberately best-effort: if Google is unreachable we show the normal
  // availability rather than hiding a day's bookings behind an outage.
  const googleBusy = await busyWindowsFromGoogle(scope.ownerId, from, to);


  const result: Record<string, string[]> = {};
  const current = new Date(from);
  while (current <= to) {
    const dateKey = dateKeyOf(current);
    const dayOfWeek = current.getUTCDay();

    let slots: string[] = [];
    const override = overrideMap[dateKey];
    const daySchedule = weekly[dayOfWeek];
    if (isOff(dateKey)) {
      // Time off → nothing on any of their services.
    } else if (override) {
      if (!override.available) {
        // Whole day off → no slots.
      } else if (override.intervals && override.intervals.length) {
        // Custom hours replace the day outright.
        slots = slotsFromIntervals(override.intervals);
      } else if (override.blocked && override.blocked.length) {
        // Normal day, minus a window or two.
        const base = daySchedule?.enabled ? daySchedule.intervals : [];
        slots = slotsFromIntervals(withoutBlocked(base, override.blocked));
      }
    } else if (daySchedule?.enabled) {
      slots = slotsFromIntervals(daySchedule.intervals);
    }

    // Take out anything the owner is already busy with in Google.
    const busy = googleBusy[dateKey];
    if (busy?.length && slots.length) {
      const asIntervals = intervalsForSlots(
        override?.intervals?.length
          ? override.intervals
          : daySchedule?.intervals ?? [],
        slots,
      );
      slots = slotsFromIntervals(withoutBlocked(asIntervals, busy));
    }

    // Take out anything overlapping a booking they already have.
    const booked = bookedWindows[dateKey];
    if (booked?.length && slots.length) {
      const live = new Set(
        slotsFromIntervals(
          withoutBlocked(
            intervalsForSlots(
              override?.intervals?.length ? override.intervals : daySchedule?.intervals ?? [],
              slots,
            ),
            booked,
          ),
        ),
      );
      // A start time is also gone if a booking starts exactly then (covers
      // slots with no matching configured interval).
      const exact = new Set(booked.map((w) => w.start));
      slots = slots.filter((t) => live.has(t) && !exact.has(t));
    }
    result[dateKey] = slots;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

/** The configured intervals whose start time is still on offer. */
function intervalsForSlots(intervals: Interval[], slots: string[]): Interval[] {
  const live = new Set(slots);
  return intervals.filter((iv) => live.has(iv.start));
}

/** "HH:MM" in Europe/London for an instant, so comparisons are wall-clock. */
function londonParts(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { day, time };
}

/**
 * The owner's busy periods from their connected Google calendar, keyed by
 * date and expressed as London wall-clock windows so they line up with the
 * configured hours.
 *
 * All-day events block the whole day only when marked Busy in Google
 * (Claire, Oct 2026: a conference on 10 Dec was still bookable). Google
 * creates all-day events as Free by default, so birthdays and reminders
 * don't wipe out a day; anything Grace sets to Busy does. Multi-day events
 * block every day they cover.
 */
async function busyWindowsFromGoogle(
  ownerId: string | null,
  from: Date,
  to: Date,
): Promise<Record<string, Interval[]>> {
  if (!ownerId) return {};
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { googleRefreshToken: true, googleCalendarId: true },
  });
  if (!owner?.googleRefreshToken) return {};

  const events = await listUpcomingEvents({
    refreshToken: owner.googleRefreshToken,
    calendarId: owner.googleCalendarId,
    from,
    // Include the whole of the last day.
    to: new Date(to.getTime() + 24 * 60 * 60 * 1000),
  });
  if (!events) return {}; // fail open — never hide availability over an outage

  const out: Record<string, Interval[]> = {};
  for (const e of events) {
    if (!e.busy) continue;
    if (e.allDay) {
      // Google all-day dates are UTC midnights; the end date is exclusive.
      const endKey = e.endAt.slice(0, 10);
      for (
        let d = new Date(`${e.startAt.slice(0, 10)}T00:00:00Z`);
        d.toISOString().slice(0, 10) < endKey;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        (out[d.toISOString().slice(0, 10)] ??= []).push({ start: "00:00", end: "23:59" });
      }
      continue;
    }
    const s = londonParts(e.startAt);
    const en = londonParts(e.endAt);
    // An event running past midnight is clipped to its first day; the
    // overnight remainder isn't clinic time anyway.
    const end = en.day === s.day ? en.time : "23:59";
    (out[s.day] ??= []).push({ start: s.time, end });
  }
  return out;
}
