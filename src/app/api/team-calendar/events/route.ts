/**
 * Team-calendar event feed.
 *
 *   GET /api/team-calendar/events?from=ISO&to=ISO
 *
 * Returns every event in the requested window from every staff
 * member's connected Google Calendar ICS feed, plus every portal booking
 * (so associates who haven't connected a Google Calendar still show up —
 * Claire's "master calendar", Oct 2026), flattened into a single list and
 * tagged with the owning user. Staff-only.
 *
 * Each member's feed is fetched in parallel. A failure to fetch one
 * member's feed (network error, revoked URL, bad ICS) returns an
 * empty list for that member — the rest of the team still renders.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAndParseIcs, type IcsEvent } from "@/lib/ics-parser";
import { listUpcomingEvents } from "@/lib/google-calendar";

export const maxDuration = 30;

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

interface TeamEvent extends IcsEvent {
  userId: string;
  userName: string;
  userColour: string;
  /** Set when this is a portal booking rather than a diary entry. */
  bookingId?: string;
}

/** Bookings with no owner are shown under this pseudo-member. */
const PRACTICE_ID = "practice";
const PRACTICE_COLOUR = "#475569";

/**
 * A booking's start instant. `date` is the UK calendar day (stored as UK
 * midnight — 23:00Z in summer — or, for older rows, UTC midnight) and
 * `time` is UK wall-clock "HH:MM".
 */
function bookingStart(date: Date, time: string): Date {
  // Snap to the intended calendar day whichever way it was stored.
  const day = new Date(date.getTime() + 12 * 3_600_000);
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const guess = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    Number.isNaN(h) ? 9 : h,
    Number.isNaN(m) ? 0 : m,
  );
  // London's offset from UTC at that moment (0 in winter, +1h in summer).
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLondon = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess - (asLondon - guess));
}

/** Minutes from the service, else read from the label ("1 hour", "45 min"). */
function bookingMinutes(serviceMinutes: number | null | undefined, label: string): number {
  if (serviceMinutes && serviceMinutes > 0) return serviceMinutes;
  const hr = label.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/i);
  if (hr) return Math.round(parseFloat(hr[1]) * 60);
  const min = label.match(/(\d+)\s*min/i);
  if (min) return parseInt(min[1], 10);
  return 60;
}

function parseIso(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Default window: today → +14 days. The frontend can ask for any
  // arbitrary range via ?from=&to= for week / month views.
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60_000); // include yesterday
  const defaultTo = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  const from = parseIso(req.nextUrl.searchParams.get("from")) ?? defaultFrom;
  const to = parseIso(req.nextUrl.searchParams.get("to")) ?? defaultTo;

  // Everyone on staff who has connected their Google Calendar.
  // We fetch all of them — the admin view shows everyone overlaid;
  // a future filter UI can hide per-person.
  // Anyone connected by EITHER route: the OAuth connection (preferred — live
  // and needs no secret URL) or the older iCal feed. Someone with both is
  // read via OAuth only, so their events don't appear twice.
  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "TEAM_MANAGER"] },
      isAutomation: false,
    },
    select: {
      id: true,
      name: true,
      calendarIcsUrl: true,
      calendarColour: true,
      googleRefreshToken: true,
      googleCalendarId: true,
      showOnTeamCalendar: true,
    },
  });

  // Default colour palette so events still look distinct even if no
  // one has set a custom colour yet. Indexed by staff-list position.
  const PALETTE = [
    // Strong, clearly different hues — events are drawn as solid blocks in
    // these colours, so neighbours in the list mustn't look alike.
    "#2563eb", // blue
    "#059669", // green
    "#d97706", // amber
    "#db2777", // pink
    "#ea580c", // orange
    "#7c3aed", // purple
    "#0891b2", // cyan
    "#65a30d", // lime
  ];

  const fromMs = from.getTime();
  const toMs = to.getTime();

  // People removed from this calendar keep their connection and their own
  // booking sync — we simply don't read their diary here.
  const shown = staff.filter((u) => u.showOnTeamCalendar);

  // Colour comes from a person's place in the FULL list, so hiding someone
  // doesn't recolour everyone below them.
  const colourFor = new Map(
    staff.map((u, idx) => [u.id, u.calendarColour ?? PALETTE[idx % PALETTE.length]]),
  );

  const perStaff = await Promise.all(
    shown.map(async (u) => {
      if (!u.googleRefreshToken && !u.calendarIcsUrl) return [];
      // Prefer the API: it's live, whereas Google only republishes the iCal
      // feed every few hours. Fall back to iCal if the API call fails, so a
      // revoked token doesn't blank someone who still has a feed configured.
      let events: IcsEvent[] | null = null;
      if (u.googleRefreshToken) {
        events = await listUpcomingEvents({
          refreshToken: u.googleRefreshToken,
          calendarId: u.googleCalendarId,
          from,
          to,
        });
      }
      if (!events && u.calendarIcsUrl) {
        events = await fetchAndParseIcs(u.calendarIcsUrl);
      }
      if (!events) return [];
      const colour = colourFor.get(u.id)!;
      const inWindow = events.filter((e) => {
        const start = new Date(e.startAt).getTime();
        const end = new Date(e.endAt).getTime();
        // Event overlaps the window if it ends after `from` and
        // starts before `to`. Includes events that span the window.
        return end >= fromMs && start <= toMs;
      });
      return inWindow.map<TeamEvent>((e) => ({
        ...e,
        userId: u.id,
        userName: u.name,
        userColour: colour,
      }));
    }),
  );

  // ── Portal bookings ─────────────────────────────────────────────
  // Widen the DB window by a day either side; exact overlap is checked
  // after the start time is worked out.
  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: new Date(fromMs - 864e5), lte: new Date(toMs + 864e5) },
      // Associates only see their own bookings, as on the Bookings page.
      ...(session.user.role === "SUPER_ADMIN" ? {} : { ownerId: session.user.id }),
    },
    select: {
      id: true,
      service: true,
      date: true,
      time: true,
      duration: true,
      clientName: true,
      ownerId: true,
      groupId: true,
      sessionIndex: true,
      googleEventId: true,
      status: true,
    },
  });
  const services = await prisma.bookingService.findMany({
    select: { slug: true, title: true, durationMinutes: true, locationLabel: true },
  });
  const serviceBySlug = new Map(services.map((sv) => [sv.slug, sv]));
  const shownIds = new Set(shown.map((u) => u.id));
  const staffIds = new Set(staff.map((u) => u.id));
  const nameFor = new Map(staff.map((u) => [u.id, u.name]));

  const bookingEvents: TeamEvent[] = [];
  const syncedGoogleIds = new Set<string>();
  let hasPracticeBookings = false;
  for (const b of bookings) {
    const ownerId = b.ownerId && staffIds.has(b.ownerId) ? b.ownerId : PRACTICE_ID;
    if (ownerId !== PRACTICE_ID && !shownIds.has(ownerId)) continue;
    const sv = serviceBySlug.get(b.service);
    const start = bookingStart(b.date, b.time);
    const end = new Date(start.getTime() + bookingMinutes(sv?.durationMinutes, b.duration) * 60_000);
    if (end.getTime() < fromMs || start.getTime() > toMs) continue;
    if (b.googleEventId) syncedGoogleIds.add(b.googleEventId);
    if (ownerId === PRACTICE_ID) hasPracticeBookings = true;
    const session = b.groupId && b.sessionIndex ? ` (session ${b.sessionIndex})` : "";
    bookingEvents.push({
      uid: `booking-${b.id}`,
      bookingId: b.id,
      title: `${sv?.title ?? b.service} — ${b.clientName}${session}`,
      location: sv?.locationLabel ?? undefined,
      description: b.status === "pending" ? "Not confirmed yet (awaiting payment)" : undefined,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: false,
      userId: ownerId,
      userName: ownerId === PRACTICE_ID ? "Practice" : nameFor.get(ownerId) ?? "Practice",
      userColour: ownerId === PRACTICE_ID ? PRACTICE_COLOUR : colourFor.get(ownerId)!,
    });
  }

  // A booking already written into someone's Google Calendar would
  // otherwise appear twice — keep the booking version.
  const merged = [
    ...perStaff.flat().filter((e) => !syncedGoogleIds.has(e.uid)),
    ...bookingEvents,
  ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return NextResponse.json({
    events: merged,
    // Hidden people are still listed so they can be put back — otherwise
    // removing someone would leave no way to undo it.
    members: [
      ...staff.map((u) => ({
        id: u.id,
        name: u.name,
        colour: colourFor.get(u.id)!,
        connected: !!u.calendarIcsUrl || !!u.googleRefreshToken,
        hidden: !u.showOnTeamCalendar,
      })),
      ...(hasPracticeBookings
        ? [{ id: PRACTICE_ID, name: "Practice", colour: PRACTICE_COLOUR, connected: false, hidden: false }]
        : []),
    ],
  });
}
