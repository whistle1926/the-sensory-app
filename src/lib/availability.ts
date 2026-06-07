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
 */
import { prisma } from "@/lib/prisma";

export interface Interval {
  start: string;
  end: string;
}

export interface AvailabilityScope {
  /** BookingService.id to scope to, or null for the global default calendar. */
  serviceId: string | null;
  /** Owner whose existing bookings block slots, or null for the practice. */
  ownerId: string | null;
}

/** Generate 30-minute slot start-times from a list of intervals. */
export function slotsFromIntervals(intervals: Interval[]): string[] {
  const slots: string[] = [];
  for (const iv of intervals) {
    if (!iv?.start || !iv?.end) continue;
    const [sh, sm] = iv.start.split(":").map(Number);
    const [eh, em] = iv.end.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) continue;
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    for (let m = startMins; m < endMins; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }
  return slots;
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
  overrideMap: Record<string, { available: boolean; intervals: Interval[] | null }>;
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
    { available: boolean; intervals: Interval[] | null }
  > = {};
  for (const o of overrideRows) {
    overrideMap[dateKeyOf(o.date)] = {
      available: o.available,
      intervals: o.intervals as unknown as Interval[] | null,
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
  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: from, lte: to },
      status: { not: "cancelled" },
      ownerId: scope.ownerId,
    },
    select: { date: true, time: true },
  });
  const bookedSet = new Set<string>();
  for (const b of bookings) {
    bookedSet.add(`${dateKeyOf(b.date)}_${b.time}`);
  }

  const result: Record<string, string[]> = {};
  const current = new Date(from);
  while (current <= to) {
    const dateKey = dateKeyOf(current);
    const dayOfWeek = current.getUTCDay();

    let slots: string[] = [];
    const override = overrideMap[dateKey];
    if (override) {
      if (override.available && override.intervals) {
        slots = slotsFromIntervals(override.intervals);
      }
      // unavailable override → no slots
    } else {
      const daySchedule = weekly[dayOfWeek];
      if (daySchedule?.enabled) {
        slots = slotsFromIntervals(daySchedule.intervals);
      }
    }

    slots = slots.filter((t) => !bookedSet.has(`${dateKey}_${t}`));
    result[dateKey] = slots;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}
