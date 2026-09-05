/**
 * GET /api/cron/payment-sweep
 *
 * Catches payments that are authorised after the buyer has gone.
 *
 * Access is granted once the payer's bank authorises the payment, which is
 * normally within a minute — but a buyer can close the thanks page before
 * that, or their bank app can sit on the approval for a while. Without this
 * a late authorisation would stay pending for ever: no access, no receipt,
 * and nothing in the day's takings.
 *
 * This re-checks anything recent and still unpaid, and completes whatever
 * Fire now reports as authorised. Safe to run repeatedly — each completion
 * is idempotent.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCoursePayment } from "@/lib/course-payment-check";
import { checkBookingPayment } from "@/lib/booking-payment-check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How far back to look. Beyond this, a payment is not coming. */
const WINDOW_DAYS = 14;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 864e5);

  const purchases = await prisma.coursePurchase.findMany({
    where: { paymentStatus: "pending", paymentRef: { not: null }, createdAt: { gte: since } },
    select: { id: true },
    take: 40,
  });
  const bookings = await prisma.booking.findMany({
    where: {
      paymentStatus: { not: "paid" },
      paymentRef: { not: null },
      price: { gt: 0 },
      createdAt: { gte: since },
    },
    select: { id: true },
    take: 40,
  });

  const completed = { courses: 0, bookings: 0 };

  for (const p of purchases) {
    try {
      if ((await checkCoursePayment(p.id)).paid) completed.courses++;
    } catch (err) {
      console.error("[payment-sweep] course check failed:", p.id, err);
    }
  }
  for (const b of bookings) {
    try {
      if ((await checkBookingPayment(b.id)).paid) completed.bookings++;
    } catch (err) {
      console.error("[payment-sweep] booking check failed:", b.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: { courses: purchases.length, bookings: bookings.length },
    completed,
  });
}
