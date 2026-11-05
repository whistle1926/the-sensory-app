/**
 * GET /api/payments/requests — every payment we've asked a client for, in
 * one list (Claire, Nov 2026): invoices we've sent, booking payment links
 * (a block of sessions counts once) and online course checkouts. Each row
 * says whether it's paid, so it can be reconciled against Fire / the bank
 * and the outstanding ones chased.
 *
 * Read-only. Paid status comes from the same place each record already
 * keeps it (Invoice.status/paidAt, Booking.paymentStatus,
 * CoursePurchase.paymentStatus) — nothing here decides payment itself.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FIRE_PAY_BASE = "https://payments.fire.com/";

export type RequestSource = "invoice" | "booking" | "course";
export type RequestState = "paid" | "outstanding" | "no_link" | "unfinished";

export interface PaymentRequestRow {
  id: string;
  source: RequestSource;
  requestedAt: string;
  clientName: string;
  clientEmail: string;
  description: string;
  reference: string | null;
  amountPence: number;
  currency: string;
  state: RequestState;
  paidAt: string | null;
  paidMethod: string | null;
  dueDate: string | null;
  payUrl: string | null;
  /** Portal page to open the record. */
  href: string;
  /** For booking rows: the booking id the chase / mark-paid buttons act on. */
  bookingId?: string;
  invoiceId?: string;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [invoices, bookings, services, purchases] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { notIn: ["draft", "cancelled"] } },
      select: {
        id: true, invoiceNumber: true, clientName: true, clientEmail: true, currency: true,
        status: true, total: true, paymentRef: true, paymentUrl: true, paidAt: true,
        paidMethod: true, sentAt: true, createdAt: true, dueDate: true,
      },
    }),
    prisma.booking.findMany({
      where: { price: { gt: 0 } },
      select: {
        id: true, service: true, date: true, time: true, price: true, clientName: true,
        clientEmail: true, status: true, paymentStatus: true, paymentRef: true,
        groupId: true, sessionIndex: true, createdAt: true, paidAt: true, paidMethod: true,
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    prisma.bookingService.findMany({ select: { slug: true, title: true } }),
    prisma.coursePurchase.findMany({
      where: { paymentStatus: { not: "failed" }, amount: { gt: 0 } },
      select: {
        id: true, amount: true, currency: true, groupId: true, paymentStatus: true,
        paymentRef: true, createdAt: true, completedAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows: PaymentRequestRow[] = [];

  for (const inv of invoices) {
    const paid = inv.status === "paid" || inv.paidAt !== null;
    rows.push({
      id: `inv_${inv.id}`,
      source: "invoice",
      requestedAt: (inv.sentAt ?? inv.createdAt).toISOString(),
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      description: `Invoice ${inv.invoiceNumber}`,
      reference: inv.invoiceNumber,
      amountPence: inv.total,
      currency: inv.currency,
      state: paid ? "paid" : "outstanding",
      paidAt: inv.paidAt?.toISOString() ?? null,
      paidMethod: paid ? (inv.paidMethod ?? "fire") : null,
      dueDate: inv.dueDate.toISOString(),
      payUrl: inv.paymentUrl,
      href: `/invoices/${inv.id}`,
      invoiceId: inv.id,
    });
  }

  // A block of sessions is one payment request for the group total.
  const titleFor = new Map(services.map((s) => [s.slug, s.title]));
  const groups = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = b.groupId ?? b.id;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    const first = list[0];
    const live = list.filter((b) => b.status !== "cancelled");
    const paid = list.some((b) => b.paymentStatus === "paid");
    // A cancelled, unpaid booking is no longer owed.
    if (live.length === 0 && !paid) continue;
    const counted = paid ? list : live;
    const ref = list.find((b) => b.paymentRef)?.paymentRef ?? null;
    const title = titleFor.get(first.service) ?? first.service;
    const when = `${dayLabel(first.date)} ${first.time}`;
    rows.push({
      id: `bk_${first.groupId ?? first.id}`,
      source: "booking",
      requestedAt: first.createdAt.toISOString(),
      clientName: first.clientName,
      clientEmail: first.clientEmail,
      description:
        counted.length > 1
          ? `${title} — ${counted.length} sessions from ${when}`
          : `${title} — ${when}`,
      reference: ref,
      amountPence: counted.reduce((s, b) => s + b.price, 0),
      currency: "GBP",
      state: paid ? "paid" : ref ? "outstanding" : "no_link",
      paidAt: list.find((b) => b.paidAt)?.paidAt?.toISOString() ?? null,
      paidMethod: paid ? (list.find((b) => b.paidMethod)?.paidMethod ?? "fire") : null,
      dueDate: first.date.toISOString(),
      payUrl: ref ? `${FIRE_PAY_BASE}${ref}` : null,
      href: `/bookings`,
      bookingId: (paid ? first : (live[0] ?? first)).id,
    });
  }

  // One checkout = one payment, even with add-ons.
  const checkouts = new Map<string, typeof purchases>();
  for (const p of purchases) {
    const key = p.groupId ?? p.id;
    const list = checkouts.get(key) ?? [];
    list.push(p);
    checkouts.set(key, list);
  }
  for (const list of checkouts.values()) {
    const first = list[0];
    const paid = list.some((p) => p.paymentStatus === "paid");
    rows.push({
      id: `cp_${first.groupId ?? first.id}`,
      source: "course",
      requestedAt: first.createdAt.toISOString(),
      clientName: first.user.name,
      clientEmail: first.user.email,
      description: list.map((p) => p.course.title).join(" + "),
      reference: first.paymentRef,
      amountPence: list.reduce((s, p) => s + p.amount, 0),
      currency: first.currency,
      // A course checkout the buyer never finished isn't a debt to chase.
      state: paid ? "paid" : "unfinished",
      paidAt: (list.find((p) => p.completedAt)?.completedAt ?? null)?.toISOString() ?? null,
      paidMethod: paid ? "fire" : null,
      dueDate: null,
      payUrl: null,
      href: `/training`,
    });
  }

  rows.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
