import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getFirePaymentsReceived, syncFireIncomeToTracker } from "@/lib/fire-payments";

export const maxDuration = 30;

function money(pence: number, cur = "GBP"): string {
  return (pence / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: cur,
  });
}

/**
 * Daily "payments received in Fire" digest. Pulls the real account
 * transactions, keeps the ones that landed in roughly the last day, and
 * emails a summary so the practice knows what's actually been paid —
 * without anyone having to check. Read-only: never writes invoice status.
 */
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

  const result = await getFirePaymentsReceived();
  if (!result.configured) {
    return NextResponse.json({ ok: true, configured: false });
  }

  // Keep the income tracker (→ dashboard revenue) in step with the real
  // Fire payments, stamped with their actual landing dates.
  const sync = await syncFireIncomeToTracker();

  // Landed in roughly the last 25 hours (cron runs daily; a little overlap
  // is harmless — this is an FYI digest, not a ledger).
  const cutoff = Date.now() - 25 * 60 * 60 * 1000;
  const recent = result.payments.filter(
    (p) => new Date(p.date).getTime() >= cutoff,
  );

  if (recent.length > 0) {
    const settings = await prisma.emailSettings.findUnique({
      where: { id: "default" },
    });
    const to = settings?.senderEmail || "patrick@thesensorysubmarine.com";
    const rows = recent
      .map(
        (p) => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${new Date(
            p.date,
          ).toLocaleString("en-GB")}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;color:#15803d;">+ ${money(
            p.amountPence,
            p.currency,
          )}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${
            p.invoiceNumber
              ? `${p.invoiceNumber}${p.clientName ? ` — ${p.clientName}` : ""}`
              : "Not linked to an invoice"
          }</td>
        </tr>`,
      )
      .join("");
    const total = recent.reduce(
      (s, p) => s + (p.currency === "GBP" ? p.amountPence : 0),
      0,
    );
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <h2 style="margin:0 0 4px;">Payments received in Fire</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">${recent.length} payment${
        recent.length === 1 ? "" : "s"
      } landed in your Fire account in the last day${
        total > 0 ? ` · ${money(total)} (GBP)` : ""
      }.</p>
      <table style="border-collapse:collapse;font-size:14px;">
        <thead><tr style="text-align:left;color:#6b7280;font-size:12px;">
          <th style="padding:6px 10px;">Received</th>
          <th style="padding:6px 10px;">Amount</th>
          <th style="padding:6px 10px;">For</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Source: real Fire account transactions. The Sensory Submarine.</p>
    </body></html>`;
    await sendMail({
      to,
      subject: `💰 ${recent.length} payment${
        recent.length === 1 ? "" : "s"
      } received in Fire`,
      html,
    });
  }

  return NextResponse.json({
    ok: true,
    received: recent.length,
    totalPayments: result.payments.length,
    incomeSynced: sync.synced,
  });
}
