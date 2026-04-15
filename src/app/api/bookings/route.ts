import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { sendMail, buildPasswordSetupEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { service, date, time, duration, price, clientName, clientEmail, clientPhone, notes } = body;

  if (!service || !date || !time || !clientName || !clientEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
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
    },
  });

  // Auto-create CLIENT user account (+ password setup token + email)
  let accountCreated = false;
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalisedEmail },
    });

    if (!existingUser) {
      // Random unguessable password — user sets their real one via email link
      const randomHash = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
      const newUser = await prisma.user.create({
        data: {
          email: normalisedEmail,
          name: clientName,
          passwordHash: randomHash,
          role: "CLIENT",
        },
      });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.passwordSetupToken.create({
        data: {
          userId: newUser.id,
          token,
          expiresAt,
        },
      });

      accountCreated = true;

      // Best-effort: send the setup email
      const origin = req.nextUrl.origin;
      const setupUrl = `${origin}/set-password?token=${token}`;
      await sendMail({
        to: normalisedEmail,
        subject: "Set your password · The Sensory Submarine",
        html: buildPasswordSetupEmail({ clientName, setupUrl }),
      });
    }
  } catch (err) {
    // Don't block the booking on user-creation failure
    console.error("Auto-create account failed:", err);
  }

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
