/**
 * GET /api/bookings/[bookingId]/checklist — the booking's to-do status
 * (Claire, Nov 2026: "a checklist when you click into a booking for the
 * referral form and payment having been completed (or not)").
 *
 * Read-only. Paying by bank transfer is ticked off with the existing
 * mark-paid route; "referral not needed" with the referral route.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findReferralForm, latestReferralSubmission, referralWaived } from "@/lib/booking-referral";

export const dynamic = "force-dynamic";

type RefState = "returned" | "not_needed" | "sent" | "not_sent" | "switched_off";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      ownerId: true,
      service: true,
      clientEmail: true,
      price: true,
      groupId: true,
      paymentStatus: true,
      paidAt: true,
      paidMethod: true,
      referralFormSentAt: true,
      referralReminderSentAt: true,
    },
  });
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (role !== "SUPER_ADMIN" && b.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // A block is paid once and chased once — look across every session.
  const sessions = b.groupId
    ? await prisma.booking.findMany({
        where: { groupId: b.groupId },
        select: {
          price: true,
          paymentStatus: true,
          paidAt: true,
          paidMethod: true,
          referralFormSentAt: true,
          referralReminderSentAt: true,
        },
      })
    : [b];
  const paidRow = sessions.find((s) => s.paymentStatus === "paid");
  const total = sessions.reduce((t, s) => t + (s.price ?? 0), 0);

  // ── Referral form ────────────────────────────────────────────────
  const sentAt = sessions.map((s) => s.referralFormSentAt).find(Boolean) ?? null;
  const reminderAt = sessions.map((s) => s.referralReminderSentAt).find(Boolean) ?? null;
  const form = await findReferralForm();
  const sub = form && b.clientEmail ? await latestReferralSubmission(form.id, b.clientEmail) : null;

  let referral: { state: RefState; at: string | null; reminderAt: string | null; href: string | null };
  if (sub && form) {
    referral = {
      state: "returned",
      at: sub.submittedAt.toISOString(),
      reminderAt: null,
      href: `/forms/${form.id}/entries/${sub.id}`,
    };
  } else if (b.clientEmail && (await referralWaived(b.clientEmail))) {
    referral = { state: "not_needed", at: null, reminderAt: null, href: null };
  } else if (sentAt) {
    referral = {
      state: "sent",
      at: sentAt.toISOString(),
      reminderAt: reminderAt?.toISOString() ?? null,
      href: null,
    };
  } else {
    const svc = await prisma.bookingService.findUnique({
      where: { slug: b.service },
      select: { autoSendReferralForm: true },
    });
    referral = {
      state: svc && !svc.autoSendReferralForm ? "switched_off" : "not_sent",
      at: null,
      reminderAt: null,
      href: null,
    };
  }

  return NextResponse.json({
    referral,
    payment: {
      free: total <= 0,
      paid: Boolean(paidRow),
      paidAt: paidRow?.paidAt?.toISOString() ?? null,
      method: paidRow?.paidMethod ?? null,
      totalPence: total,
      sessions: sessions.length,
    },
    canMarkPaid: role === "SUPER_ADMIN",
  });
}
