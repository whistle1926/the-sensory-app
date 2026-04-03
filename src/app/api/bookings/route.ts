import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      clientEmail,
      clientPhone: clientPhone || null,
      notes: notes || null,
    },
  });

  // TODO: Send confirmation email via Mailcub if enabled
  // TODO: Integrate payment provider (Firebuddy / Stripe / etc.)

  return NextResponse.json({ success: true, bookingId: booking.id });
}

export async function GET() {
  // Admin-only: list all bookings (for future calendar management)
  const bookings = await prisma.booking.findMany({
    orderBy: { date: "asc" },
    where: { status: { not: "cancelled" } },
  });

  return NextResponse.json(bookings);
}
