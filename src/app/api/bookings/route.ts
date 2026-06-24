import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
} from "@/lib/booking-automation";
import { sendTransactionalEmail } from "@/lib/email";

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

  if (!service || !date || !time || !clientName || !clientEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
    select: { ownerId: true },
  });
  const ownerId = svc?.ownerId ?? null;

  // Check for a clash on the SAME owner's calendar. Two different
  // associates can hold the same date/time; one associate cannot be
  // booked twice. Owner null = the practice's shared calendar.
  const bookingDate = new Date(date);
  const existing = await prisma.booking.findFirst({
    where: {
      date: bookingDate,
      time,
      ownerId,
      status: { not: "cancelled" },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This time slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  const depositPolicy = DEPOSIT_SERVICES[service];
  const booking = await prisma.booking.create({
    data: {
      service,
      ownerId,
      date: bookingDate,
      time,
      duration: duration || "",
      price: price || 0,
      clientName,
      clientEmail: normalisedEmail,
      clientPhone: clientPhone || null,
      notes: notes || null,
      acceptedTermsAt: new Date(),
      acceptedTermsVersion: termsCfg.version,
      depositRequired: Boolean(depositPolicy),
      depositAmount: depositPolicy?.amountPence ?? 0,
    },
  });

  // Notify the owning associate (best-effort) that they have a new
  // booking. Routed to the service owner's email; falls back to silence
  // for unassigned/practice services (Grace already gets the calendar
  // view). Never blocks the booking.
  void notifyOwnerOfBooking({
    ownerId,
    clientName,
    clientEmail: normalisedEmail,
    service,
    date: bookingDate,
    time,
  }).catch((err) => console.error("Owner booking notification failed:", err));

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
    time,
    duration: duration || "",
    pricePence: price || 0,
    depositPence: depositPolicy?.amountPence,
  }).catch((err) => console.error("Booking confirmation email failed:", err));

  // Attempt to create FireBuddy payment if enabled
  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  if (paymentSettings?.enabled && paymentSettings.apiKey) {
    try {
      const fb = new FireBuddy(paymentSettings.apiKey);
      const origin = req.nextUrl.origin;
      const payment = await fb.createPayment({
        amount: (price || 0) / 100, // price is in pence, FireBuddy expects pounds
        currency: "GBP",
        description: `${service} — ${clientName}`,
        reference: booking.id,
        email: normalisedEmail,
        returnUrl: `${origin}/book/success?booking=${booking.id}${accountCreated ? "&newAccount=1" : ""}`,
      });

      // Store payment reference on booking
      await prisma.booking.update({
        where: { id: booking.id },
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

/** Email the owning associate a short heads-up about a new booking.
 *  Best-effort: returns quietly if the service is unassigned or the
 *  owner has no email on file. */
async function notifyOwnerOfBooking(args: {
  ownerId: string | null;
  clientName: string;
  clientEmail: string;
  service: string;
  date: Date;
  time: string;
}) {
  if (!args.ownerId) return;
  const owner = await prisma.user.findUnique({
    where: { id: args.ownerId },
    select: { email: true, name: true },
  });
  if (!owner?.email) return;

  const svc = await prisma.bookingService.findUnique({
    where: { slug: args.service },
    select: { title: true },
  });
  const serviceTitle = svc?.title ?? args.service;
  const dateLabel = args.date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  await sendTransactionalEmail({
    to: owner.email,
    subject: `New booking: ${serviceTitle} — ${dateLabel} at ${args.time}`,
    html: `<p>Hi ${owner.name?.split(" ")[0] ?? "there"},</p>
<p>You have a new booking for <strong>${serviceTitle}</strong>.</p>
<ul>
  <li><strong>When:</strong> ${dateLabel} at ${args.time}</li>
  <li><strong>Client:</strong> ${args.clientName} (${args.clientEmail})</li>
</ul>
<p>It's on your bookings page in the portal.</p>`,
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
