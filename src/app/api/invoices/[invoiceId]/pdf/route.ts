/**
 * Printable / downloadable copy of an invoice.
 *
 *   GET /api/invoices/[invoiceId]/pdf
 *
 * Returns a branded, self-contained invoice document as HTML and auto-opens
 * the browser's print dialog, where the user picks "Save as PDF". Same
 * approach as the report + home-programme exports (no headless Chrome).
 *
 * This is the *document* — deliberately NOT the payment email: no "Pay now"
 * CTA. It's the copy you'd send to an accountant, a school's finance team,
 * or (the reason it exists) Fire compliance when they ask for a copy.
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [payment, emailSettings] = await Promise.all([
    prisma.paymentSettings.findUnique({ where: { id: "default" } }),
    prisma.emailSettings.findUnique({ where: { id: "default" } }),
  ]);
  const contactEmail =
    emailSettings?.replyTo?.trim() || "info@thesensorysubmarine.com";

  const cur = invoice.currency || "GBP";
  const sym = SYMBOLS[cur] || "£";
  const money = (pence: number) => `${sym}${(pence / 100).toFixed(2)}`;
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const rows = invoice.items
    .map(
      (i) => `<tr>
        <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;">${escapeHtml(i.description)}</td>
        <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;text-align:center;">${i.quantity}</td>
        <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;text-align:right;">${money(i.unitPrice)}</td>
        <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;text-align:right;">${money(i.amount)}</td>
      </tr>`,
    )
    .join("");

  const isPaid = invoice.status === "paid";
  const statusColour = isPaid
    ? "#15803d"
    : invoice.status === "cancelled"
      ? "#b91c1c"
      : "#b45309";

  const bankBlock =
    invoice.bankTransfer && payment?.bankAccountNumber
      ? `<div style="margin:24px 0 0;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#888;">Pay by bank transfer</p>
          ${payment.bankAccountName ? `<p style="margin:0 0 3px;font-size:13px;color:#333;"><strong>Account name:</strong> ${escapeHtml(payment.bankAccountName)}</p>` : ""}
          ${payment.bankSortCode ? `<p style="margin:0 0 3px;font-size:13px;color:#333;"><strong>Sort code:</strong> ${escapeHtml(payment.bankSortCode)}</p>` : ""}
          ${payment.bankAccountNumber ? `<p style="margin:0 0 3px;font-size:13px;color:#333;"><strong>Account number:</strong> ${escapeHtml(payment.bankAccountNumber)}</p>` : ""}
          <p style="margin:6px 0 0;font-size:13px;color:#333;"><strong>Reference:</strong> ${escapeHtml(invoice.invoiceNumber)}</p>
        </div>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(invoice.invoiceNumber)} — The Sensory Submarine</title>
  <style>
    @media print { .no-print { display: none !important; } body { background: #fff !important; } }
    body { margin:0; padding:24px; background:#f5f5f5; font-family:Arial,Helvetica,sans-serif; }
    .sheet { max-width:760px; margin:0 auto; background:#fff; padding:40px; border-radius:12px; }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:760px;margin:0 auto 12px;text-align:right;">
    <button onclick="window.print()" style="background:#1a1a2e;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">
      Save as PDF / Print
    </button>
  </div>
  <div class="sheet">
    <!-- Header -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr>
        <td style="vertical-align:top;">
          <img src="https://portal.thesensorysubmarine.com/brand/logo.jpg" alt="The Sensory Submarine" width="90" style="display:block;border:0;"/>
          <p style="margin:10px 0 0;font-size:15px;font-weight:700;color:#1a1a2e;">The Sensory Submarine</p>
          <p style="margin:2px 0 0;font-size:12px;color:#777;">Occupational Therapy Services</p>
          <p style="margin:2px 0 0;font-size:12px;color:#777;">Northern Ireland</p>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <h1 style="margin:0;font-size:30px;letter-spacing:2px;color:#1a1a2e;">INVOICE</h1>
          <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:#333;">${escapeHtml(invoice.invoiceNumber)}</p>
          <p style="margin:8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${statusColour};">${escapeHtml(invoice.status)}</p>
        </td>
      </tr>
    </table>

    <!-- Bill to + dates -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#888;">Bill to</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#222;">${escapeHtml(invoice.clientName)}</p>
          ${invoice.clientAddress ? `<p style="margin:3px 0 0;font-size:13px;line-height:1.5;color:#555;">${escapeHtml(invoice.clientAddress).replace(/\n/g, "<br/>")}</p>` : ""}
          ${invoice.clientEmail ? `<p style="margin:3px 0 0;font-size:13px;color:#555;">${escapeHtml(invoice.clientEmail)}</p>` : ""}
        </td>
        <td style="vertical-align:top;text-align:right;">
          <p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#888;">Issued:</strong> ${fmtDate(invoice.createdAt)}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#888;">Due:</strong> ${fmtDate(invoice.dueDate)}</p>
          ${invoice.paidAt ? `<p style="margin:0;font-size:13px;color:#15803d;"><strong>Paid:</strong> ${fmtDate(invoice.paidAt)}</p>` : ""}
        </td>
      </tr>
    </table>

    <!-- Items -->
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#1a1a2e;">
          <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;color:#fff;text-align:left;">Description</th>
          <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;color:#fff;text-align:center;">Qty</th>
          <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;color:#fff;text-align:right;">Unit Price</th>
          <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;color:#fff;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#555;text-align:right;">Subtotal</td>
          <td style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#333;text-align:right;">${money(invoice.subtotal)}</td>
        </tr>
        ${invoice.tax > 0 ? `<tr>
          <td colspan="3" style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#555;text-align:right;">Tax</td>
          <td style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#333;text-align:right;">${money(invoice.tax)}</td>
        </tr>` : ""}
        <tr>
          <td colspan="3" style="border:1px solid #e5e7eb;padding:12px 14px;font-size:15px;font-weight:700;color:#1a1a2e;text-align:right;background:#f9fafb;">Total (${escapeHtml(cur)})</td>
          <td style="border:1px solid #e5e7eb;padding:12px 14px;font-size:15px;font-weight:700;color:#1a1a2e;text-align:right;background:#f9fafb;">${money(invoice.total)}</td>
        </tr>
      </tfoot>
    </table>

    ${invoice.notes ? `<div style="margin:24px 0 0;"><p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#888;">Notes</p><p style="margin:0;font-size:13px;line-height:1.6;color:#555;">${escapeHtml(invoice.notes).replace(/\n/g, "<br/>")}</p></div>` : ""}

    ${bankBlock}

    <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;"/>
    <p style="margin:0;font-size:11px;color:#999;text-align:center;">
      The Sensory Submarine &middot; Occupational Therapy Services &middot; Any questions? Email
      <a href="mailto:${escapeHtml(contactEmail)}" style="color:#999;">${escapeHtml(contactEmail)}</a>
    </p>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
