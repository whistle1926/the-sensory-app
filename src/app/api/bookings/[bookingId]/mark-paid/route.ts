/**
 * Mark a booking paid off-Fire, or undo that (Claire, Nov 2026).
 *
 * POST   { method: "cash" | "bank_transfer" | "card" | "other", paidAt?: ISO }
 * DELETE — undo a manual mark (a Fire-confirmed payment can't be undone here).
 *
 * Used from Payment requests when the money turns up in the bank or is paid
 * in person. A block of sessions is one payment, so the whole group is
 * marked together. Deliberately sends NO emails — unlike a Fire payment,
 * this is often recorded after the appointment has happened. Credits the
 * income tracker the same way a manual invoice mark does. Admins only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const METHODS = ["cash", "bank_transfer", "card", "other"];

async function loadGroup(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return null;
  const sessions = booking.groupId
    ? await prisma.booking.findMany({
        where: { groupId: booking.groupId },
        orderBy: [{ date: "asc" }, { time: "asc" }],
      })
    : [booking];
  return { booking, sessions };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const body = (await req.json().catch(() => ({}))) as { method?: unknown; paidAt?: unknown };
  const method = typeof body.method === "string" && METHODS.includes(body.method) ? body.method : "other";
  const when = typeof body.paidAt === "string" ? new Date(body.paidAt) : null;
  const paidAt =
    when && Number.isFinite(when.getTime()) && when.getTime() <= Date.now() + 864e5 ? when : new Date();

  const group = await loadGroup(bookingId);
  if (!group) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const { sessions } = group;
  if (sessions.some((s) => s.paymentStatus === "paid")) {
    return NextResponse.json({ error: "This booking is already marked paid." }, { status: 400 });
  }

  await prisma.booking.updateMany({
    where: { id: { in: sessions.map((s) => s.id) } },
    data: { paymentStatus: "paid", paidAt, paidMethod: method },
  });
  // Confirm the live sessions (cancelled ones stay cancelled).
  await prisma.booking.updateMany({
    where: { id: { in: sessions.map((s) => s.id) }, status: "pending" },
    data: { status: "confirmed" },
  });

  const primary = sessions[0];
  const total = sessions.reduce((sum, s) => sum + s.price, 0);
  if (total > 0) {
    await prisma.incomeEntry
      .upsert({
        where: { source_reference: { source: "BOOKING", reference: primary.id } },
        update: { amount: total, description: `${primary.service} — ${primary.clientName}` },
        create: {
          amount: total,
          source: "BOOKING",
          reference: primary.id,
          description: `${primary.service} — ${primary.clientName}`,
          occurredAt: paidAt,
        },
      })
      .catch((err) => console.error("[booking/mark-paid] income credit failed:", err));
  }

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "booking.mark_paid",
    targetType: "booking",
    targetId: primary.id,
    meta: { method, total, sessions: sessions.length, clientName: primary.clientName },
    req,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const group = await loadGroup(bookingId);
  if (!group) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const { sessions } = group;
  const paid = sessions.filter((s) => s.paymentStatus === "paid");
  if (paid.length === 0) return NextResponse.json({ error: "This booking isn't marked paid." }, { status: 400 });
  if (paid.some((s) => !s.paidMethod || s.paidMethod === "fire")) {
    return NextResponse.json(
      { error: "Fire confirmed this payment, so it can't be undone here." },
      { status: 400 },
    );
  }

  await prisma.booking.updateMany({
    where: { id: { in: sessions.map((s) => s.id) } },
    data: { paymentStatus: "unpaid", paidAt: null, paidMethod: null },
  });
  await prisma.incomeEntry
    .deleteMany({ where: { source: "BOOKING", reference: { in: sessions.map((s) => s.id) } } })
    .catch((err) => console.error("[booking/mark-paid] income reversal failed:", err));

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "booking.mark_unpaid",
    targetType: "booking",
    targetId: sessions[0].id,
    meta: { clientName: sessions[0].clientName },
    req,
  });

  return NextResponse.json({ ok: true });
}
