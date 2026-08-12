import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLateBookingReminders } from "@/lib/booking-reminder";
import { FireBuddy } from "@/lib/firebuddy";
import { ensureParentAccount } from "@/lib/parent-account";
import { DEPOSIT_SERVICES } from "@/lib/booking-terms";
import {
  getTermsConfig,
  clausesForServiceFromDb,
} from "@/lib/booking-terms-store";
import {
  getEnabledAutomation,
  renderTemplate,
  variablesForBooking,
  buildCalendarLink,
} from "@/lib/booking-automation";
import { sendTransactionalEmail } from "@/lib/email";
import { insertBookingEvent } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    service,
    date,
    time,
    duration,
    price,
    clientName,
    clientEmail,
    clientPhone,
    notes,
    acceptedTermsVersion,
    acceptedClauses,
  } = body;

  // Slots the client picked. A single appointment posts { date, time };
  // a block posts slots: [{ date, time }, ...]. Normalise both to one
  // array so the rest of the flow doesn't care which it was.
  const rawSlots: Array<{ date?: unknown; time?: unknown }> = Array.isArray(
    body.slots,
  ) && body.slots.length > 0
    ? body.slots
    : [{ date, time }];
  const slots = rawSlots
    .filter(
      (s): s is { date: string; time: string } =>
        !!s && typeof s.date === "string" && typeof s.time === "string",
    )
    .map((s) => ({ date: new Date(s.date), time: s.time }))
    .filter((s) => Number.isFinite(s.date.getTime()));

  if (!service || slots.length === 0 || !clientName || !clientEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Two sessions can't be at the same date+time as each other.
  const slotKeys = slots.map((s) => `${s.date.toISOString()}_${s.time}`);
  if (new Set(slotKeys).size !== slotKeys.length) {
    return NextResponse.json(
      { error: "You've picked the same appointment twice — choose different times." },
      { status: 400 },
    );
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Staff booking on a client's behalf (manual booking from the admin
  // dashboard, e.g. a phone enquiry) skips the public T&C gate — the
  // parent isn't sitting at the form ticking boxes.
  const session = await auth();
  const isStaffBooking =
    !!session?.user && session.user.role !== "CLIENT";

  const termsCfg = await getTermsConfig();
  if (!isStaffBooking) {
    // Validate T&C agreement: client must have ticked every applicable
    // clause and submitted with the live terms version. We re-derive the
    // expected list server-side so a mischievous client can't strip clauses.
    const expectedClauseIds = (
      await clausesForServiceFromDb(service)
    ).map((c) => c.id);
    const submittedIds: string[] = Array.isArray(acceptedClauses) ? acceptedClauses : [];
    const allTicked = expectedClauseIds.every((id) => submittedIds.includes(id));
    if (!allTicked || acceptedTermsVersion !== termsCfg.version) {
      return NextResponse.json(
        { error: "Please tick all of the terms boxes to confirm your booking." },
        { status: 400 },
      );
    }
  }

  const normalisedEmail = clientEmail.toLowerCase().trim();

  // Resolve the service so we can attribute the booking to its owning
  // associate (or the practice when unassigned). ownerId is snapshotted
  // onto the booking for the per-owner double-book check + admin views.
  const svc = await prisma.bookingService.findUnique({
    where: { slug: service },
    select: {
      ownerId: true,
      pricePence: true,
      durationLabel: true,
      durationMinutes: true,
      minSessions: true,
      maxSessions: true,
      title: true,
      locationLabel: true,
    },
  });
  // A staff member booking manually can hand the appointment to a specific
  // therapist, overriding the service's usual owner — the phone enquiry that
  // Grace will actually see, on a service nobody is assigned to. Only honoured
  // for staff bookings; a public booking always follows the service.
  let ownerId = svc?.ownerId ?? null;
  if (isStaffBooking && typeof body.ownerId === "string" && body.ownerId) {
    const chosen = await prisma.user.findUnique({
      where: { id: body.ownerId },
      select: { id: true, role: true },
    });
    if (!chosen || chosen.role === "CLIENT") {
      return NextResponse.json(
        { error: "That therapist doesn't exist." },
        { status: 400 },
      );
    }
    ownerId = chosen.id;
  }

  // How many dates is this service allowed in one booking? 1/1 for an
  // ordinary appointment; a block is e.g. 2..5.
  const minSessions = Math.max(1, svc?.minSessions ?? 1);
  const maxSessions = Math.max(minSessions, svc?.maxSessions ?? 1);
  if (slots.length < minSessions || slots.length > maxSessions) {
    return NextResponse.json(
      {
        error:
          minSessions === maxSessions
            ? `Please choose ${minSessions} appointment${minSessions === 1 ? "" : "s"}.`
            : `Please choose between ${minSessions} and ${maxSessions} appointments — you picked ${slots.length}.`,
      },
      { status: 400 },
    );
  }

  // Price + duration come from the SERVICE, not the request. The admin
  // "New booking" form doesn't send them (bookings landed at price=0, so
  // the confirmation email said "Total: £0"), and trusting a public
  // client's `price` would let anyone book at whatever amount they liked.
  // Fall back to the posted values only if the service can't be resolved.
  const resolvedPrice = svc ? svc.pricePence : (price ?? 0);
  const resolvedDuration = svc
    ? svc.durationLabel || `${svc.durationMinutes} minutes`
    : (duration ?? "");

  // Check EVERY requested slot against the SAME owner's calendar. Two
  // different associates can hold the same date/time; one associate can't
  // be booked twice. Owner null = the practice's shared calendar.
  for (const slot of slots) {
    const existing = await prisma.booking.findFirst({
      where: {
        date: slot.date,
        time: slot.time,
        ownerId,
        status: { not: "cancelled" },
      },
    });
    if (existing) {
      const label = slot.date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/London",
      });
      return NextResponse.json(
        {
          error:
            slots.length > 1
              ? `${label} at ${slot.time} has just been taken — please pick another time for that session.`
              : "This time slot is no longer available. Please choose another.",
        },
        { status: 409 },
      );
    }
  }

  const depositPolicy = DEPOSIT_SERVICES[service];
  const isBlock = slots.length > 1;
  // One id ties a block's sessions together; a single appointment has none.
  const groupId = isBlock ? randomUUID() : null;
  // Each session is priced at the per-session rate; the client pays the
  // sum in a single payment request (see below).
  const totalPrice = resolvedPrice * slots.length;

  // Earliest slot first, so "session 1 of 5" means what you'd expect and
  // the confirmation lists them in order.
  const ordered = [...slots].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time),
  );

  const created = await prisma.$transaction(
    ordered.map((slot, i) =>
      prisma.booking.create({
        data: {
          service,
          ownerId,
          date: slot.date,
          time: slot.time,
          duration: resolvedDuration,
          price: resolvedPrice,
          groupId,
          sessionIndex: isBlock ? i + 1 : null,
          clientName,
          clientEmail: normalisedEmail,
          clientPhone: clientPhone || null,
          notes: notes || null,
          acceptedTermsAt: new Date(),
          acceptedTermsVersion: termsCfg.version,
          depositRequired: Boolean(depositPolicy),
          depositAmount: depositPolicy?.amountPence ?? 0,
        },
      }),
    ),
  );
  // The first session represents the booking in emails/redirects.
  const booking = created[0];
  const bookingDate = booking.date;
  const firstTime = booking.time;

  // Notify the owning associate (best-effort) that they have a new
  // booking. Routed to the service owner's email; unassigned/practice
  // services fall back to the practice inbox (EmailSettings.senderEmail)
  // so they still reach someone. Never blocks the booking.
  void notifyOwnerOfBooking({
    ownerId,
    clientName,
    clientEmail: normalisedEmail,
    service,
    date: bookingDate,
    time: firstTime,
    extraSessions: created.length - 1,
  }).catch((err) => console.error("Owner booking notification failed:", err));

  // The daily reminder sweep only looks a day ahead, so anything booked
  // after this morning's run for tomorrow would never get a reminder. Send
  // those now. Best-effort and non-blocking, like the notifications above.
  void sendLateBookingReminders(
    created.map((b) => ({
      id: b.id,
      service: b.service,
      date: b.date,
      time: b.time,
      duration: b.duration,
      clientName: b.clientName,
      clientEmail: b.clientEmail,
    })),
  ).catch((err) => console.error("Late booking reminder failed:", err));

  // Write each session into the owner's Google Calendar if they've connected
  // OAuth write-sync (Settings → Calendar). Best-effort and non-blocking:
  // any failure is swallowed so it can never break the booking; the one-click
  // "Add to Google Calendar" button in the owner email remains the fallback.
  void syncBookingsToGoogleCalendar({
    ownerId,
    bookings: created.map((b) => ({ id: b.id, date: b.date, time: b.time })),
    serviceTitle: svc?.title ?? service,
    durationMinutes: svc?.durationMinutes ?? 60,
    location: svc?.locationLabel ?? undefined,
    clientName,
    clientEmail: normalisedEmail,
    clientPhone: clientPhone || undefined,
    notes: notes || undefined,
  }).catch((err) => console.error("Google Calendar sync failed:", err));

  // Auto-create CLIENT user account (+ password setup token + email)
  let accountCreated = false;
  try {
    const result = await ensureParentAccount({
      email: normalisedEmail,
      name: clientName,
      origin: req.nextUrl.origin,
    });
    accountCreated = result.created;
  } catch (err) {
    // Don't block the booking on user-creation failure
    console.error("Auto-create account failed:", err);
  }

  // Send a booking confirmation email that re-states the T&Cs the client
  // agreed to (audit trail in their inbox). Best-effort — don't fail the
  // booking if Mailcub is offline.
  void sendBookingConfirmationEmail({
    to: normalisedEmail,
    clientName,
    service,
    date: bookingDate,
    time: firstTime,
    duration: resolvedDuration,
    // The client is quoted the TOTAL they'll pay — for a block that's the
    // per-session rate × the sessions they picked.
    pricePence: totalPrice,
    depositPence: depositPolicy?.amountPence,
    sessions: ordered,
  }).catch((err) => console.error("Booking confirmation email failed:", err));

  // Attempt to create FireBuddy payment if enabled
  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  if (paymentSettings?.enabled && paymentSettings.apiKey) {
    try {
      const fb = new FireBuddy(paymentSettings.apiKey);
      const origin = req.nextUrl.origin;
      // ONE payment request for the whole booking — for a block that's
      // the total for every session, not one charge per date. The webhook
      // resolves a "group:" reference to all of the block's sessions.
      const payment = await fb.createPayment({
        amount: totalPrice / 100, // pence → pounds
        currency: "GBP",
        description: isBlock
          ? `${svc?.title ?? service} — ${slots.length} sessions — ${clientName}`
          : `${service} — ${clientName}`,
        reference: groupId ? `group:${groupId}` : booking.id,
        email: normalisedEmail,
        returnUrl: `${origin}/book/success?booking=${booking.id}${accountCreated ? "&newAccount=1" : ""}`,
      });

      // Stamp the payment on every session of the booking.
      await prisma.booking.updateMany({
        where: groupId ? { groupId } : { id: booking.id },
        data: { paymentRef: payment.code },
      });

      return NextResponse.json({
        success: true,
        bookingId: booking.id,
        paymentUrl: payment.paymentUrl,
        accountCreated,
      });
    } catch (err) {
      console.error("FireBuddy payment creation failed:", err);
      // Booking is still created — fall through to non-payment response
    }
  }

  // No payment integration or payment creation failed
  return NextResponse.json({ success: true, bookingId: booking.id, accountCreated });
}

export async function GET() {
  // Staff-only: list all bookings (for future calendar management).
  // Previously this had a doc comment saying "Admin-only" but no
  // auth check — and since /api/* is excluded from the global
  // middleware, anyone hitting the URL got client names, emails,
  // phone numbers and notes for every booking. Now gated.
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Associates (TEAM_MANAGER) see only the bookings for services they
  // own; SUPER_ADMIN sees everything. Legacy/practice bookings (owner
  // null) stay with the admins.
  const ownerScope =
    session.user.role === "SUPER_ADMIN"
      ? {}
      : { ownerId: session.user.id };

  // Bounded + column-scoped: only the fields the calendar/list render,
  // and a hard cap so the payload can't grow without limit as bookings
  // accumulate. 1000 covers well beyond a single practice's live load.
  const bookings = await prisma.booking.findMany({
    orderBy: { date: "asc" },
    where: { status: { not: "cancelled" }, ...ownerScope },
    take: 1000,
    select: {
      id: true,
      service: true,
      date: true,
      time: true,
      duration: true,
      price: true,
      clientName: true,
      clientEmail: true,
      status: true,
      paymentStatus: true,
    },
  });

  return NextResponse.json(bookings);
}

/**
 * Write each session of a booking into the owning associate's Google
 * Calendar, if they've connected OAuth write-sync. Stores the created event
 * id on each booking row so cancellation can delete it later. Entirely
 * best-effort — never throws, and does nothing if the owner isn't connected
 * or the service is unassigned.
 */
async function syncBookingsToGoogleCalendar(args: {
  ownerId: string | null;
  bookings: Array<{ id: string; date: Date; time: string }>;
  serviceTitle: string;
  durationMinutes: number;
  location?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  notes?: string;
}) {
  if (!args.ownerId) return;
  const owner = await prisma.user.findUnique({
    where: { id: args.ownerId },
    select: { googleRefreshToken: true, googleCalendarId: true },
  });
  if (!owner?.googleRefreshToken) return;

  const descriptionLines = [
    `Client: ${args.clientName}`,
    `Email: ${args.clientEmail}`,
    args.clientPhone ? `Phone: ${args.clientPhone}` : null,
    args.notes ? `Notes: ${args.notes}` : null,
    "",
    "Booked via The Sensory Submarine portal.",
  ].filter(Boolean);
  const description = descriptionLines.join("\n");
  const isBlock = args.bookings.length > 1;

  for (let i = 0; i < args.bookings.length; i++) {
    const b = args.bookings[i];
    const summary = isBlock
      ? `${args.serviceTitle} (${i + 1}/${args.bookings.length}) — ${args.clientName}`
      : `${args.serviceTitle} — ${args.clientName}`;
    const eventId = await insertBookingEvent({
      refreshToken: owner.googleRefreshToken,
      calendarId: owner.googleCalendarId,
      summary,
      description,
      location: args.location,
      date: b.date,
      time: b.time,
      durationMinutes: args.durationMinutes,
    });
    if (eventId) {
      await prisma.booking
        .update({ where: { id: b.id }, data: { googleEventId: eventId } })
        .catch(() => {
          /* row update is best-effort; event still exists in Google */
        });
    }
  }
}

/** Email a "new booking" heads-up to the staff member responsible, with a
 *  one-click "Add to Google Calendar" button so it lands in their Google
 *  diary (our email provider can't attach a real .ics invite, so a Google
 *  render link is the reliable no-login way to get it there).
 *
 *  Recipient: the owning associate if the service has one; otherwise the
 *  practice admin inbox (emailSettings.senderEmail) so unassigned/practice
 *  bookings still reach a calendar. Best-effort — returns quietly if there's
 *  no usable recipient. */
async function notifyOwnerOfBooking(args: {
  ownerId: string | null;
  clientName: string;
  clientEmail: string;
  service: string;
  date: Date;
  time: string;
  /** Sessions booked beyond the first — >0 means this was a block, so the
   * therapist knows more dates are in their calendar. */
  extraSessions?: number;
}) {
  // Resolve the recipient: owner if set, else the practice admin inbox.
  let toEmail: string | null = null;
  let toName: string | null = null;
  if (args.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: args.ownerId },
      select: { email: true, name: true },
    });
    toEmail = owner?.email ?? null;
    toName = owner?.name ?? null;
  } else {
    const settings = await prisma.emailSettings.findUnique({
      where: { id: "default" },
      select: { senderEmail: true },
    });
    toEmail = settings?.senderEmail ?? null;
    toName = null; // practice inbox — no personal greeting
  }
  if (!toEmail) return;

  const svc = await prisma.bookingService.findUnique({
    where: { slug: args.service },
    select: { title: true, durationMinutes: true },
  });
  const serviceTitle = svc?.title ?? args.service;
  const durationMinutes = svc?.durationMinutes ?? 60;
  // Label the calendar day AS SEEN IN LONDON — the stored instant can sit at
  // 23:00 UTC the night before during BST, so formatting in UTC would show
  // the wrong day. Europe/London keeps it on the day staff actually expect.
  const dateLabel = args.date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });

  // One-click "add to Google Calendar" for THIS appointment (first session
  // of a block). buildCalendarLink derives the London day + applies
  // ctz=Europe/London, so it's correct across BST/GMT with no date-maths here.
  const calLink = buildCalendarLink({
    title: `${serviceTitle} — ${args.clientName}`,
    date: args.date,
    time: args.time,
    durationMinutes,
  });
  const calButton = `<p style="margin:20px 0;">
  <a href="${calLink}" style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">📅 Add to Google Calendar</a>
</p>`;

  const extra = args.extraSessions ?? 0;
  await sendTransactionalEmail({
    to: toEmail,
    subject: `New booking: ${serviceTitle} — ${dateLabel} at ${args.time}`,
    html: `<p>Hi ${toName?.split(" ")[0] ?? "there"},</p>
<p>You have a new booking for <strong>${serviceTitle}</strong>${
      extra > 0 ? ` — a block of ${extra + 1} sessions` : ""
    }.</p>
<ul>
  <li><strong>${extra > 0 ? "First session" : "When"}:</strong> ${dateLabel} at ${args.time}</li>
  ${extra > 0 ? `<li><strong>Plus:</strong> ${extra} further session${extra === 1 ? "" : "s"} — add each of those from the portal's booking list</li>` : ""}
  <li><strong>Client:</strong> ${args.clientName} (${args.clientEmail})</li>
</ul>
${calButton}
<p style="font-size:12px;color:#777;">It's also on your bookings page in the portal. The button above adds it to your Google Calendar in one click${extra > 0 ? " (the first session — the block's other dates can be added from the portal)" : ""}.</p>`,
  });
}

/** Render-and-send the booking confirmation email using the
 * "confirmation" automation row. If that row is disabled or missing the
 * function silently returns — letting Patrick turn confirmations off
 * from the admin UI without code changes. */
async function sendBookingConfirmationEmail(args: {
  to: string;
  clientName: string;
  service: string;
  date: Date;
  time: string;
  duration: string;
  pricePence: number;
  depositPence?: number;
  /** Every session in the booking — one for a normal appointment, 2-5
   * for a block. Drives the {{sessions}} list in the email. */
  sessions?: Array<{ date: Date; time: string }>;
}) {
  const automation = await getEnabledAutomation("confirmation");
  if (!automation) return;
  const vars = await variablesForBooking({
    clientName: args.clientName,
    service: args.service,
    date: args.date,
    time: args.time,
    duration: args.duration,
    pricePence: args.pricePence,
    depositPence: args.depositPence,
    sessions: args.sessions,
  });
  await sendTransactionalEmail({
    to: args.to,
    subject: renderTemplate(automation.subject, vars),
    html: renderTemplate(automation.bodyHtml, vars),
  });
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}
