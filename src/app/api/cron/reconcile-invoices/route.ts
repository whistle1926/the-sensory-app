/**
 * Daily cron — pull payment status from FireBuddy for every unpaid
 * invoice and mark the completed ones paid. Backstop for when the
 * FireBuddy webhook doesn't fire.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Schedule registered in /vercel.json.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reconcileInvoicePayments } from "@/lib/invoice-reconcile";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcileInvoicePayments();
  return NextResponse.json({ ok: true, ...result });
}
