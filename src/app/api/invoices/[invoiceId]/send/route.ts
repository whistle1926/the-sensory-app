import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { sendMail } from "@/lib/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;

  // 1. Load invoice
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  // 2. Load payment settings
  const settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.enabled || !settings.apiKey) {
    return NextResponse.json(
      { error: "Payment integration is not configured. Please set up FireBuddy in Settings." },
      { status: 400 }
    );
  }

  // 3. Create FireBuddy payment
  const origin =
    req.headers.get("origin") ||
    req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
    "https://thesensorysubmarine.com";

  let result;
  try {
    const fb = new FireBuddy(settings.apiKey);
    result = await fb.createPayment({
      amount: invoice.total / 100, // convert pence to pounds
      currency: (invoice.currency || "GBP") as "GBP" | "EUR" | "USD",
      description: `Invoice ${invoice.invoiceNumber}`,
      reference: `invoice:${invoice.id}`,
      email: invoice.clientEmail,
      returnUrl: `${origin}/invoices/${invoice.id}`,
    });
  } catch (err) {
    console.error("FireBuddy payment creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create payment link. Please check your FireBuddy settings." },
      { status: 502 }
    );
  }

  // 4. Update invoice with payment details
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paymentRef: result.code,
      paymentUrl: result.paymentUrl,
      status: "sent",
      sentAt: new Date(),
    },
    include: { items: true },
  });

  // 5. Send email
  const emailHtml = buildInvoiceEmail({
    invoice: updatedInvoice,
    paymentUrl: result.paymentUrl,
  });

  const emailSent = await sendMail({
    to: invoice.clientEmail,
    subject: `Invoice ${invoice.invoiceNumber} from The Sensory Submarine`,
    html: emailHtml,
  });

  if (!emailSent) {
    console.error(`Invoice ${invoice.invoiceNumber}: payment link created but email failed to send`);
  }

  return NextResponse.json({
    success: true,
    invoice: updatedInvoice,
    paymentUrl: result.paymentUrl,
    emailSent,
  });
}

// ---------------------------------------------------------------------------
// Invoice email template
// ---------------------------------------------------------------------------

interface InvoiceWithItems {
  invoiceNumber: string;
  clientName: string;
  currency: string;
  dueDate: Date;
  createdAt: Date;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

function buildInvoiceEmail(params: {
  invoice: InvoiceWithItems;
  paymentUrl: string;
}): string {
  const { invoice, paymentUrl } = params;

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const cur = invoice.currency || "GBP";
  const symbols: Record<string, string> = { GBP: "\u00a3", EUR: "\u20ac", USD: "$" };
  const sym = symbols[cur] || "\u00a3";
  const formatPence = (pence: number) =>
    `${sym}${(pence / 100).toFixed(2)}`;

  const itemRows = invoice.items
    .map(
      (item) => `
        <tr>
          <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;">
            ${escapeHtml(item.description)}
          </td>
          <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;text-align:center;">
            ${item.quantity}
          </td>
          <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;text-align:right;">
            ${formatPence(item.unitPrice)}
          </td>
          <td style="border:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#333;text-align:right;">
            ${formatPence(item.amount)}
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">

    <!-- Header -->
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">The Sensory Submarine</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.7;">Occupational Therapy Services</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">

      <p style="margin:0 0 16px;font-size:15px;color:#222;">
        Hi ${escapeHtml(invoice.clientName)},
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
        Please find your invoice below.
      </p>

      <!-- Invoice details -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#555;font-weight:700;">Invoice Number</td>
            <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;">${escapeHtml(invoice.invoiceNumber)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#555;font-weight:700;">Date Issued</td>
            <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;">${formatDate(invoice.createdAt)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#555;font-weight:700;">Due Date</td>
            <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;">${formatDate(invoice.dueDate)}</td>
          </tr>
        </table>
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;" cellpadding="0" cellspacing="0">
        <thead>
          <tr style="background:#1a1a2e;">
            <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;font-weight:700;color:#fff;text-align:left;">Description</th>
            <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;font-weight:700;color:#fff;text-align:center;">Qty</th>
            <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;font-weight:700;color:#fff;text-align:right;">Unit Price</th>
            <th style="border:1px solid #1a1a2e;padding:10px 14px;font-size:13px;font-weight:700;color:#fff;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          <tr style="background:#f9fafb;">
            <td colspan="3" style="border:1px solid #e5e7eb;padding:12px 14px;font-size:15px;font-weight:700;color:#1a1a2e;text-align:right;">
              Total
            </td>
            <td style="border:1px solid #e5e7eb;padding:12px 14px;font-size:15px;font-weight:700;color:#1a1a2e;text-align:right;">
              ${formatPence(invoice.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Pay Now button -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${escapeHtml(paymentUrl)}"
           style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:700;font-size:16px;">
          Pay Now
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:12px;color:#777;">
        Or copy this link to pay:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#1a1a2e;word-break:break-all;">
        ${escapeHtml(paymentUrl)}
      </p>

      <!-- Footer -->
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-align:center;">
        The Sensory Submarine &middot; Occupational Therapy Services
      </p>
      <p style="margin:0;font-size:11px;color:#bbb;text-align:center;">
        If you have any questions about this invoice, please reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
