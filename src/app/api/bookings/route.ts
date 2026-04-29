import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { ensureParentAccount } from "@/lib/parent-account";
import {
  TERMS_VERSION,
  DEPOSIT_SERVICES,
  clausesForService,
  renderTermsHtml,
} from "@/lib/booking-terms";
import { bookingServiceMeta } from "@/lib/booking-services";
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

  // Validate T&C agreement: client must have ticked every applicable
  // clause and submitted with the current TERMS_VERSION. We re-derive the
  // expected list server-side so a mischievous client can't strip clauses.
  const expectedClauseIds = clausesForService(service).map((c) => c.id);
  const submittedIds: string[] = Array.isArray(acceptedClauses) ? acceptedClauses : [];
  const allTicked = expectedClauseIds.every((id) => submittedIds.includes(id));
  if (!allTicked || acceptedTermsVersion !== TERMS_VERSION) {
    return NextResponse.json(
      { error: "Please tick all of the terms boxes to confirm your booking." },
      { status: 400 },
    );
  }

  const normalisedEmail = clientEmail.toLowerCase().trim();

  // Check for duplicate booking at the same date/time
  const bookingDate = new Date(date);
  const existing = await prisma.booking.findFirst({
    where: {
      date: bookingDate,
      time,
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
      date: bookingDate,
      time,
      duration: duration || "",
      price: price || 0,
      clientName,
      clientEmail: normalisedEmail,
      clientPhone: clientPhone || null,
      notes: notes || null,
      acceptedTermsAt: new Date(),
      acceptedTermsVersion: TERMS_VERSION,
      depositRequired: Boolean(depositPolicy),
      depositAmount: depositPolicy?.amountPence ?? 0,
    },
  });

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
    priceLabel: formatPrice(price || 0),
    depositLabel: depositPolicy?.label,
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
  // Admin-only: list all bookings (for future calendar management)
  const bookings = await prisma.booking.findMany({
    orderBy: { date: "asc" },
    where: { status: { not: "cancelled" } },
  });

  return NextResponse.json(bookings);
}

/** Render-and-send the booking confirmation email. Includes the T&Cs the
 * client just agreed to so they have a copy in their inbox alongside the
 * audit timestamp on the Booking row. */
async function sendBookingConfirmationEmail(args: {
  to: string;
  clientName: string;
  service: string;
  date: Date;
  time: string;
  priceLabel: string;
  depositLabel?: string;
}) {
  const dateStr = args.date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
      <h1 style="font-size:20px;margin:0 0 8px 0">Your booking is confirmed</h1>
      <p style="font-size:14px;color:#475569;margin:0 0 20px 0">
        Hi ${escapeHtml(args.clientName)}, thanks for booking with The Sensory Submarine.
      </p>
      <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC">
        <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.04em">Booking details</p>
        <p style="margin:0;font-size:14px;line-height:1.7">
          <strong>Service:</strong> ${escapeHtml(bookingServiceMeta(args.service).title)}<br/>
          <strong>Date:</strong> ${escapeHtml(dateStr)}<br/>
          <strong>Time:</strong> ${escapeHtml(args.time)}<br/>
          <strong>Total:</strong> ${escapeHtml(args.priceLabel)}
          ${args.depositLabel ? `<br/><strong>Deposit (non-refundable):</strong> ${escapeHtml(args.depositLabel)}` : ""}
        </p>
      </div>
      ${renderTermsHtml(args.service)}
      <p style="font-size:12px;color:#94A3B8;margin-top:24px">
        If you need to cancel or reschedule, please reply to this email as soon as possible.
        Cancellation charges apply per the terms above.
      </p>
    </div>`;
  await sendTransactionalEmail({
    to: args.to,
    subject: "Your booking with The Sensory Submarine is confirmed",
    html,
  });
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
