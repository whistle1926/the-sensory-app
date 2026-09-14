import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAvailability } from "@/lib/availability";

/**
 * Public GET — available 30-min slots for a date range.
 *
 *   ?from=2026-04-07&to=2026-04-13   (optional, defaults to next 7 days)
 *   ?service=<slug>                  (optional; scopes slots to that
 *                                     service's own calendar + owner)
 *
 * Without a service param it falls back to the global default calendar
 * (back-compat with the original single-practitioner behaviour).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const serviceSlug = searchParams.get("service");

  const from = fromStr ? new Date(fromStr + "T00:00:00Z") : new Date();
  const to = toStr
    ? new Date(toStr + "T00:00:00Z")
    : new Date(Date.now() + 7 * 86400000);

  // Resolve the service slug to its id + owner. Unknown / missing slug
  // → global default calendar.
  let serviceId: string | null = null;
  let ownerId: string | null = null;
  if (serviceSlug) {
    const svc = await prisma.bookingService.findUnique({
      where: { slug: serviceSlug },
      select: { id: true, ownerId: true },
    });
    if (svc) {
      serviceId = svc.id;
      ownerId = svc.ownerId;
    }
  }

  const result = await computeAvailability(from, to, { serviceId, ownerId });

  // Public booking rules (only when the public book page asks, via
  // ?public=1 — the admin availability preview must stay unfiltered):
  //   • at least 48h lead time, so there's room to screen + sort paperwork
  //   • no further than ~3 months out, a rolling window so nobody books
  //     into next year.
  if (searchParams.get("public") === "1") {
    const MIN_LEAD_MS = 48 * 60 * 60 * 1000;
    const MAX_AHEAD_MS = 92 * 24 * 60 * 60 * 1000; // ~3 months
    const now = Date.now();
    const earliest = now + MIN_LEAD_MS;
    const latest = now + MAX_AHEAD_MS;
    for (const dateKey of Object.keys(result)) {
      // Beyond the rolling window → drop the whole day.
      const dayStart = new Date(`${dateKey}T00:00:00Z`).getTime();
      if (dayStart > latest) {
        delete result[dateKey];
        continue;
      }
      // Within the window → drop individual times inside the 48h cutoff.
      // Times are wall-clock "HH:MM"; comparing them as UTC is within an
      // hour of NI time, which is immaterial against a 48-hour gate.
      result[dateKey] = result[dateKey].filter((t) => {
        const slotMs = new Date(`${dateKey}T${t}:00Z`).getTime();
        return Number.isNaN(slotMs) || slotMs >= earliest;
      });
    }
  }

  return NextResponse.json(result);
}
