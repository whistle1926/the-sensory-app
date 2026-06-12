/**
 * Staff-triggered "Sync with FireBuddy" — pulls payment status for every
 * unpaid invoice and marks completed ones paid. Same logic as the cron,
 * but on demand from the invoices page so the OT doesn't have to wait
 * for the daily sweep.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { reconcileInvoicePayments } from "@/lib/invoice-reconcile";

export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // FireBuddy gets hit once per unpaid invoice, so cap how often this
  // can run to avoid hammering their API.
  const blocked = rateLimitOrReject("invoices.reconcile", session.user.id, {
    max: 6,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  const result = await reconcileInvoicePayments();
  return NextResponse.json({ ok: true, ...result });
}
