/**
 * POST /api/bookings/[bookingId]/reschedule — move a booking to a new date
 * and/or time (Claire, Nov 2026: "sometimes we just need to change the time
 * or date for someone" — previously the only option was cancel).
 *
 * Body: { date: ISO (the day, as the booking form posts it), time: "HH:MM",
 *         notify?: boolean, force?: boolean }
 *
 * - Staff only. A clash with another of the same therapist's bookings is
 *   returned as 409 { clash } unless `force` (staff can still double up
 *   deliberately, as with a manual booking).
 * - Reminder / referral-chaser stamps are cleared so they fire again for the
 *   new date.
 * - The therapist's Google Calendar copy is moved (old event deleted, new
 *   one created). Best-effort.
 * - `notify` emails the client the new date and time.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { bookingDayKey, bookingMinutes } from "@/lib/booking-duration";
import { deleteBookingEvent, insertBookingEvent } from "@/lib/google-calendar";
import { buildCalendarLink } from "@/lib/booking-automation";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    date?: unknown;
    time?: unknown;
    notify?: unknown;
    force?: unknown;
  };
  const date = typeof body.date === "string" ? new Date(body.date) : null;
  const time = typeof body.time === "string" ? body.time : "";
  if (!date || !Number.isFinite(date.getTime()) || !TIME_RE.test(time)) {
    return NextResponse.json({ error: "Pick a new date and time." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking is cancelled." }, { status: 400 });
  }
  if (bookingDayKey(booking.date) === bookingDayKey(date) && booking.time === time) {
    return NextResponse.json({ error: "That's the same date and time it's already booked for." }, { status: 400 });
  }

  const svc = await prisma.bookingService.findUnique({
    where: { slug: booking.service },
    select: { title: true, durationMinutes: true, locationLabel: true },
  });
  const minutes = bookingMinutes(svc?.durationMinutes, booking.duration);

  // Same therapist, overlapping time on the new day (this booking excluded).
  if (body.force !== true) {
    const dayKey = bookingDayKey(date);
    const midnight = Date.parse(`${dayKey}T00:00:00Z`);
    const around = await prisma.booking.findMany({
      where: {
        id: { not: booking.id },
        ownerId: booking.ownerId,
        status: { not: "cancelled" },
        // ±1 day, then matched on the UK day key below (stored dates can
        // sit at 23:00Z the night before).
        date: { gte: new Date(midnight - 86_400_000), lte: new Date(midnight + 86_400_000) },
      },
      select: { time: true, date: true, duration: true, service: true, clientName: true },
    });
    const start = toMinutes(time);
    const end = start + minutes;
    for (const o of around) {
      if (bookingDayKey(o.date) !== dayKey) continue;
      const os = await prisma.bookingService.findUnique({
        where: { slug: o.service },
        select: { durationMinutes: true },
      });
      const oStart = toMinutes(o.time);
      const oEnd = oStart + bookingMinutes(os?.durationMinutes, o.duration);
      if (start < oEnd && oStart < end) {
        return NextResponse.json(
          { clash: `That overlaps ${o.clientName}'s booking at ${o.time} on the same day.` },
          { status: 409 },
        );
      }
    }
  }

  const from = { date: booking.date, time: booking.time };
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      date,
      time,
      // Re-arm the timed emails for the new appointment.
      reminderSentAt: null,
      referralReminderSentAt: null,
    },
  });

  // Move the therapist's Google Calendar copy.
  if (booking.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: booking.ownerId },
      select: { googleRefreshToken: true, googleCalendarId: true },
    });
    if (owner?.googleRefreshToken) {
      try {
        if (booking.googleEventId) {
          await deleteBookingEvent({
            refreshToken: owner.googleRefreshToken,
            calendarId: owner.googleCalendarId,
            eventId: booking.googleEventId,
          });
        }
        const eventId = await insertBookingEvent({
          refreshToken: owner.googleRefreshToken,
          calendarId: owner.googleCalendarId,
          summary: `${svc?.title ?? booking.service} — ${booking.clientName}`,
          description: [
            `Client: ${booking.clientName}`,
            `Email: ${booking.clientEmail}`,
            booking.clientPhone ? `Phone: ${booking.clientPhone}` : null,
            booking.notes ? `Notes: ${booking.notes}` : null,
            "",
            "Booked via The Sensory Submarine portal (moved).",
          ]
            .filter((l) => l !== null)
            .join("\n"),
          location: svc?.locationLabel ?? undefined,
          date,
          time,
          durationMinutes: minutes,
        });
        await prisma.booking.update({
          where: { id: booking.id },
          data: { googleEventId: eventId },
        });
      } catch (err) {
        console.error("[reschedule] Google Calendar move failed:", err);
      }
    }
  }

  let emailed = false;
  if (body.notify === true && booking.clientEmail) {
    const title = svc?.title ?? booking.service;
    const first = booking.clientName.split(" ")[0] || "there";
    const calLink = buildCalendarLink({ title, date, time, durationMinutes: minutes });
    emailed = await sendTransactionalEmail({
      to: booking.clientEmail,
      subject: `Your appointment has moved — ${dayLabel(date)} at ${time}`,
      html: `<h2>Hi ${escapeHtml(first)},</h2>
<p>Your <strong>${escapeHtml(title)}</strong> appointment has been moved.</p>
<ul>
  <li><strong>New time:</strong> ${dayLabel(date)} at ${escapeHtml(time)}</li>
  <li style="color:#777;"><strong>Was:</strong> ${dayLabel(from.date)} at ${escapeHtml(from.time)}</li>
</ul>
<p style="margin:20px 0;"><a href="${calLink}" style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">📅 Add to Google Calendar</a></p>
<p>If the new time doesn't suit, just reply to this email and we'll sort it.</p>
<p><strong>The Sensory Submarine</strong></p>`,
    })
      .then((r) => r.ok)
      .catch(() => false);
  }

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "booking.reschedule",
    targetType: "booking",
    targetId: booking.id,
    meta: {
      from: `${bookingDayKey(from.date)} ${from.time}`,
      to: `${bookingDayKey(date)} ${time}`,
      clientEmailed: emailed,
    },
    req,
  });

  return NextResponse.json({ booking: updated, emailed });
}
