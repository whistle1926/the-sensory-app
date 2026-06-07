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
  return NextResponse.json(result);
}
