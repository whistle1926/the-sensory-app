import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Interval {
  start: string;
  end: string;
}

// Generate 30-min slot times from intervals
function slotsFromIntervals(intervals: Interval[]): string[] {
  const slots: string[] = [];
  for (const iv of intervals) {
    const [sh, sm] = iv.start.split(":").map(Number);
    const [eh, em] = iv.end.split(":").map(Number);
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

// Public GET — returns available 30-min slots for a date range
// Query: ?from=2026-04-07&to=2026-04-13  (optional, defaults to next 7 days)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const from = fromStr ? new Date(fromStr + "T00:00:00Z") : new Date();
  const to = toStr ? new Date(toStr + "T00:00:00Z") : new Date(Date.now() + 7 * 86400000);

  // Fetch weekly schedule
  const weeklyRows = await prisma.weeklyHours.findMany();
  const weekly: Record<number, { enabled: boolean; intervals: Interval[] }> = {};
  for (const row of weeklyRows) {
    weekly[row.dayOfWeek] = {
      enabled: row.enabled,
      intervals: row.intervals as unknown as Interval[],
    };
  }

  // Fetch date overrides in range
  const overrides = await prisma.dateOverride.findMany({
    where: {
      date: { gte: from, lte: to },
    },
  });
  const overrideMap: Record<string, { available: boolean; intervals: Interval[] | null }> = {};
  for (const o of overrides) {
    const key = o.date.toISOString().split("T")[0];
    overrideMap[key] = {
      available: o.available,
      intervals: o.intervals as unknown as Interval[] | null,
    };
  }

  // Fetch existing bookings in range
  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: from, lte: to },
      status: { not: "cancelled" },
    },
    select: { date: true, time: true },
  });
  const bookedSet = new Set<string>();
  for (const b of bookings) {
    const dateKey = b.date.toISOString().split("T")[0];
    bookedSet.add(`${dateKey}_${b.time}`);
  }

  // Build result: { "2026-04-07": ["09:00","09:30",...], ... }
  const result: Record<string, string[]> = {};

  const current = new Date(from);
  while (current <= to) {
    const dateKey = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay(); // 0=Sun

    let slots: string[] = [];

    // Check for date override first
    const override = overrideMap[dateKey];
    if (override) {
      if (override.available && override.intervals) {
        slots = slotsFromIntervals(override.intervals);
      }
      // else: unavailable, slots stays empty
    } else {
      // Fall back to weekly schedule
      const daySchedule = weekly[dayOfWeek];
      if (daySchedule?.enabled) {
        slots = slotsFromIntervals(daySchedule.intervals);
      }
    }

    // Remove booked slots
    slots = slots.filter((t) => !bookedSet.has(`${dateKey}_${t}`));

    result[dateKey] = slots;
    current.setDate(current.getDate() + 1);
  }

  return NextResponse.json(result);
}
