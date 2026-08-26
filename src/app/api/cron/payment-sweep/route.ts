/**
 * GET /api/cron/payment-sweep
 *
 * Catches payments that settle after the buyer has gone.
 *
 * Fire's open banking is not instant: Grace started a course payment at
 * 08:27 and Fire confirmed the funds at 16:07 — nearly eight hours later.
 * The thanks page checks with Fire while the buyer is watching it, but
 * nobody sits on that page for eight hours, so a payment that settles late
 * would otherwise stay pending for ever: no access, no receipt, and nothing
 * in the day's takings.
 *
 * This re-checks anything recent and still unpaid, and completes whatever
 * has genuinely landed. Safe to run repeatedly — each completion is
 * idempotent, and only funds Fire has confirmed count.
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
