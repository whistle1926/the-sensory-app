/**
 * Team-calendar event feed.
 *
 *   GET /api/team-calendar/events?from=ISO&to=ISO
 *
 * Returns every event in the requested window from every staff
 * member's connected Google Calendar ICS feed, flattened into a
 * single list and tagged with the owning user. Staff-only.
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
      OR: [{ calendarIcsUrl: { not: null } }, { googleRefreshToken: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      calendarIcsUrl: true,
      calendarColour: true,
      googleRefreshToken: true,
      googleCalendarId: true,
    },
  });

  // Default colour palette so events still look distinct even if no
  // one has set a custom colour yet. Indexed by staff-list position.
  const PALETTE = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ec4899", // pink
    "#8b5cf6", // violet
    "#14b8a6", // teal
  ];

  const fromMs = from.getTime();
  const toMs = to.getTime();

  const perStaff = await Promise.all(
    staff.map(async (u, idx) => {
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
      const colour = u.calendarColour ?? PALETTE[idx % PALETTE.length];
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

  const merged = perStaff
    .flat()
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return NextResponse.json({
    events: merged,
    members: staff.map((u, idx) => ({
      id: u.id,
      name: u.name,
      colour: u.calendarColour ?? PALETTE[idx % PALETTE.length],
      connected: !!u.calendarIcsUrl || !!u.googleRefreshToken,
    })),
  });
}
