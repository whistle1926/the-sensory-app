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
 *
 * We specifically reject the "/public/basic.ics" variant — that's
 * the public-share URL Google shows right above the secret one in
 * the Integrate Calendar panel, and it only works if the calendar
 * is actually published publicly. Most personal calendars aren't,
 * so accepting it would lead to silent 404s on every refresh (which
 * is exactly what Patrick hit on his first connect attempt).
 */
function isValidGoogleIcsUrl(url: string): { ok: true } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "Must be https." };
  if (u.hostname !== "calendar.google.com")
    return { ok: false, reason: "Must be a calendar.google.com URL." };
  if (!u.pathname.startsWith("/calendar/ical/"))
    return { ok: false, reason: "Must be a /calendar/ical/ path." };
  if (!u.pathname.endsWith(".ics"))
    return { ok: false, reason: "Must end in .ics." };
  if (u.pathname.includes("/public/")) {
    return {
      ok: false,
      reason:
        "That's the PUBLIC iCal URL — only works for publicly shared calendars. You need the SECRET URL further down the same Google page (look for 'Secret address in iCal format' with the red warning). It contains 'private-…' in the path.",
    };
  }
  if (!/\/private-[A-Za-z0-9_-]+\//.test(u.pathname)) {
    return {
      ok: false,
      reason:
        "URL must contain a /private-…/ segment. Copy the 'Secret address in iCal format' from Google Calendar (not 'Public address').",
    };
  }
  return { ok: true };
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
      const check = isValidGoogleIcsUrl(body.icsUrl);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
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
