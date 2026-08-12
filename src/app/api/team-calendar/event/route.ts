/**
 * POST /api/team-calendar/event
 *
 * Add a plain diary entry — "Paddy on call", admin time, a school visit —
 * straight into someone's connected Google Calendar. Bookings already write
 * themselves; this is for everything that isn't a client appointment.
 *
 * It writes to GOOGLE rather than storing a portal-only event on purpose: two
 * kinds of calendar entry that behave differently is exactly the confusion
 * this system keeps having to explain. Written here, it shows up in Google on
 * the phone, and edits made in Google flow back to the team view.
 *
 * Admins can add to anyone's calendar (Claire books time for the OTs);
 * everyone else can only add to their own.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { insertBookingEvent } from "@/lib/google-calendar";

const ADMIN_ROLES = ["SUPER_ADMIN", "TEAM_MANAGER"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const role = session.user.role;
  if (role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const durationMinutes = Number(body.durationMinutes);

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { error: "Give it a title, a date and a start time." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 12 * 60) {
    return NextResponse.json(
      { error: "Pick how long it runs for." },
      { status: 400 },
    );
  }

  // Only an admin may put something in someone else's diary.
  const requestedUserId = typeof body.userId === "string" ? body.userId : "";
  const targetId =
    requestedUserId && ADMIN_ROLES.includes(role) ? requestedUserId : session.user.id;
  if (requestedUserId && requestedUserId !== session.user.id && !ADMIN_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "You can only add events to your own calendar." },
      { status: 403 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { name: true, role: true, googleRefreshToken: true, googleCalendarId: true },
  });
  if (!target || target.role === "CLIENT") {
    return NextResponse.json({ error: "No such team member." }, { status: 404 });
  }
  if (!target.googleRefreshToken) {
    return NextResponse.json(
      {
        error: `${target.name || "That person"} hasn't connected a Google Calendar yet, so there's nowhere to put this. They can connect it in Settings → Calendar.`,
      },
      { status: 400 },
    );
  }

  // Noon UTC so converting to the London day can never land on the day
  // before/after, whatever the time of year. insertBookingEvent takes the
  // London calendar day off this and sends wall-clock times to Google.
  const dayInstant = new Date(`${date}T12:00:00.000Z`);

  const eventId = await insertBookingEvent({
    refreshToken: target.googleRefreshToken,
    calendarId: target.googleCalendarId,
    summary: title,
    description: notes || undefined,
    location: location || undefined,
    date: dayInstant,
    time,
    durationMinutes,
  });

  if (!eventId) {
    return NextResponse.json(
      { error: "Google wouldn't accept the event. Try disconnecting and reconnecting the calendar in Settings." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, eventId, addedFor: target.name });
}
