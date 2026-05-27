/**
 * Per-user calendar integration settings.
 *
 *   GET    — returns the current user's saved ICS URL + colour.
 *   PATCH  — { icsUrl?: string|null; colour?: string|null }. Setting
 *            icsUrl to null/"" disconnects. The URL is validated as
 *            an https Google Calendar secret-iCal address before
 *            being stored.
 *
 * Staff-only (CLIENT users have no calendar to connect).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/** Google Calendar secret URLs look like:
 *    https://calendar.google.com/calendar/ical/<id>/private-<token>/basic.ics
 *  We accept that exact prefix to make it harder to paste the wrong
 *  thing (e.g. the calendar.google.com web URL). */
function isValidGoogleIcsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "calendar.google.com") return false;
    if (!u.pathname.startsWith("/calendar/ical/")) return false;
    if (!u.pathname.endsWith(".ics")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { calendarIcsUrl: true, calendarColour: true },
  });
  return NextResponse.json({
    icsUrl: user?.calendarIcsUrl ?? null,
    colour: user?.calendarColour ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    icsUrl?: string | null;
    colour?: string | null;
  };

  const data: { calendarIcsUrl?: string | null; calendarColour?: string | null } = {};

  if ("icsUrl" in body) {
    if (body.icsUrl === null || body.icsUrl === "") {
      data.calendarIcsUrl = null;
    } else if (typeof body.icsUrl === "string") {
      if (!isValidGoogleIcsUrl(body.icsUrl)) {
        return NextResponse.json(
          {
            error:
              "That doesn't look like a Google Calendar secret iCal URL. It should start with https://calendar.google.com/calendar/ical/ and end with .ics — find it in Google Calendar → Settings → your calendar → 'Secret address in iCal format'.",
          },
          { status: 400 },
        );
      }
      data.calendarIcsUrl = body.icsUrl;
    }
  }

  if ("colour" in body) {
    if (body.colour === null || body.colour === "") {
      data.calendarColour = null;
    } else if (typeof body.colour === "string" && /^#[0-9a-fA-F]{6}$/.test(body.colour)) {
      data.calendarColour = body.colour.toLowerCase();
    } else {
      return NextResponse.json({ error: "Colour must be a #rrggbb hex" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data });
  return NextResponse.json({ ok: true });
}
