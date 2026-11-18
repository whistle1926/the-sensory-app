import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { londonDateKey } from "@/lib/date-key";

export const dynamic = "force-dynamic";

/**
 * Search bookings by client name, email, phone, service or notes (Claire,
 * Nov 2026: "a search option on the calendar / bookings"). Covers past,
 * upcoming and cancelled bookings — the calendars only load the month in
 * view, so this is how you find someone without paging through months.
 * Associates only see bookings for their own services, as on /bookings.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const services = await prisma.bookingService.findMany({
    select: { slug: true, title: true },
  });
  const titleOf = new Map(services.map((s) => [s.slug, s.title]));
  // Searching "assessment" should find bookings by their service's title,
  // not just its slug.
  const matchingSlugs = services
    .filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))
    .map((s) => s.slug);

  const ci = { contains: q, mode: "insensitive" as const };
  const rows = await prisma.booking.findMany({
    where: {
      ...(session.user.role === "SUPER_ADMIN" ? {} : { ownerId: session.user.id }),
      OR: [
        { clientName: ci },
        { clientEmail: ci },
        { clientPhone: ci },
        { notes: ci },
        { service: ci },
        ...(matchingSlugs.length ? [{ service: { in: matchingSlugs } }] : []),
      ],
    },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true,
      service: true,
      date: true,
      time: true,
      clientName: true,
      clientEmail: true,
      status: true,
      paymentStatus: true,
      groupId: true,
      sessionIndex: true,
    },
  });

  // Upcoming first (soonest at the top), then the past (most recent first).
  const todayKey = londonDateKey(new Date());
  const withKey = rows.map((b) => ({ ...b, day: londonDateKey(b.date) }));
  const upcoming = withKey.filter((b) => b.day >= todayKey).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  const past = withKey.filter((b) => b.day < todayKey);

  const results = [...upcoming, ...past].slice(0, 40).map((b) => ({
    id: b.id,
    day: b.day,
    time: b.time,
    service: titleOf.get(b.service) ?? b.service,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    status: b.status,
    paymentStatus: b.paymentStatus,
    sessionIndex: b.sessionIndex,
    upcoming: b.day >= todayKey,
  }));
  return NextResponse.json({ results, total: rows.length });
}
