/**
 * POST /api/bookings/[bookingId]/payment-link   { send?: boolean }
 *
 * Get (and optionally email) the Fire payment link for an unpaid booking —
 * for when a client has lost the "complete payment" email (Claire, Oct
 * 2026). Booking payments aren't invoices, so they never showed in the
 * invoices log and there was no way to resend them.
 *
 * Checks Fire first: if it's actually been paid, the booking is completed
 * instead of chasing the client. Reuses the original Fire payment request
 * while it's still open; if Fire says it failed/expired, raises a fresh one.
 * Staff only; associates only for their own bookings.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { checkBookingPayment } from "@/lib/booking-payment-check";
import { sendBookingPendingEmail } from "@/lib/booking-automation";

const FIRE_PAY_BASE = "https://payments.fire.com/";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "SUPER_ADMIN" && role !== "TEAM_MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const body = (await req.json().catch(() => ({}))) as { send?: boolean };

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (role !== "SUPER_ADMIN" && booking.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status === "cancelled")
    return NextResponse.json({ error: "This booking is cancelled." }, { status: 400 });
  if (booking.paymentStatus === "paid")
    return NextResponse.json({ error: "This booking is already paid." }, { status: 400 });

  // A block shares one payment — work from all its sessions.
  const sessions = booking.groupId
    ? await prisma.booking.findMany({
        where: { groupId: booking.groupId },
        orderBy: [{ date: "asc" }, { time: "asc" }],
      })
    : [booking];
  const first = sessions[0];
  const totalPence = sessions.reduce((sum, s) => sum + s.price, 0);
  if (totalPence <= 0)
    return NextResponse.json({ error: "There's nothing to pay on this booking." }, { status: 400 });

  const settings = await prisma.paymentSettings.findUnique({ where: { id: "default" } });
  if (!settings?.enabled || !settings.apiKey)
    return NextResponse.json({ error: "Online payments aren't switched on." }, { status: 400 });
  const fb = new FireBuddy(settings.apiKey);

  // Paid after all? Then complete it rather than chase the client.
  const ref = sessions.find((s) => s.paymentRef)?.paymentRef ?? null;
  let reuse = false;
  if (ref) {
    const check = await checkBookingPayment(first.id);
    if (check.paid) return NextResponse.json({ alreadyPaid: true });
    reuse = !/fail|expire|cancel/i.test(check.status);
  }

  let paymentUrl: string;
  if (ref && reuse) {
    paymentUrl = `${FIRE_PAY_BASE}${ref}`;
  } else {
    const payment = await fb.createPayment({
      amount: totalPence / 100,
      currency: "GBP",
      description:
        sessions.length > 1
          ? `${first.service} — ${sessions.length} sessions — ${first.clientName}`
          : `${first.service} — ${first.clientName}`,
      reference: first.groupId ? `group:${first.groupId}` : first.id,
      email: first.clientEmail,
      returnUrl: `${req.nextUrl.origin}/book/success?booking=${first.id}`,
    });
    await prisma.booking.updateMany({
      where: first.groupId ? { groupId: first.groupId } : { id: first.id },
      data: { paymentRef: payment.code },
    });
    paymentUrl = payment.paymentUrl;
  }

  if (body.send) {
    const svc = await prisma.bookingService.findUnique({
      where: { slug: first.service },
      select: { title: true },
    });
    await sendBookingPendingEmail({
      to: first.clientEmail,
      clientName: first.clientName,
      service: svc?.title ?? first.service,
      date: first.date,
      time: first.time,
      sessionCount: sessions.length,
      paymentUrl,
      totalPence,
    });
  }

  return NextResponse.json({ paymentUrl, sent: Boolean(body.send), to: first.clientEmail });
}
