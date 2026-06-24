import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { FireBuddy } from "@/lib/firebuddy";
import { sendMail } from "@/lib/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Cap invoice sends per user — a compromised staff cookie shouldn't
  // be able to spam parents with payment links or rack up Mailcub
  // sends. 5/minute is well above any plausible legit pace.
  const blocked = rateLimitOrReject("invoice.send", session.user.id, {
    max: 5,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  const { invoiceId } = await params;

  // Parse optional compose fields from body. All four are optional —
  // the legacy one-click send sent an empty body which still works.
  let personalNote = "";
  let cc = "";
  let customSubject = "";
  let customTo = "";
  try {
    const body = await req.json();
    personalNote = typeof body.personalNote === "string" ? body.personalNote.trim() : "";
    cc = typeof body.cc === "string" ? body.cc.trim() : "";
    customSubject = typeof body.subject === "string" ? body.subject.trim() : "";
    customTo = typeof body.to === "string" ? body.to.trim() : "";
  } catch {
    // No body or invalid JSON — that's fine, fields are optional
  }

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

  // 4b. Mirror the invoice into FireBuddy's Accounting view so it
  // appears in Accounting → Invoices for the accountant. Failure
  // here is non-fatal — payment link + email still go out — but we
  // log it so it's visible if it starts misbehaving.
  await mirrorInvoiceToFireBuddy(updatedInvoice, settings.apiKey, result.paymentUrl).catch(
    (err) => console.error(`[INVOICE-SEND] FireBuddy mirror failed for ${invoice.invoiceNumber}:`, err),
  );

  // 5. Send email
  const emailHtml = buildInvoiceEmail({
    invoice: updatedInvoice,
    paymentUrl: result.paymentUrl,
    personalNote,
    bank: {
      accountName: settings.bankAccountName,
      sortCode: settings.bankSortCode,
      accountNumber: settings.bankAccountNumber,
      eurAccountName: settings.bankEurAccountName,
      iban: settings.bankIban,
      bic: settings.bankBic,
      instructions: settings.bankTransferInstructions,
    },
  });

  // Honour caller-supplied To / Subject when present (the compose
  // panel lets staff edit both before sending), otherwise fall back
  // to the saved client email + the default subject line.
  const mailOptions: { to: string; subject: string; html: string; cc?: string } = {
    to: customTo || invoice.clientEmail,
    subject:
      customSubject ||
      `Invoice ${invoice.invoiceNumber} from The Sensory Submarine`,
    html: emailHtml,
  };
  if (cc) mailOptions.cc = cc;

  const emailSent = await sendMail(mailOptions);

  if (!emailSent) {
    // FireBuddy has already created the payment + stamped the
    // invoice as "sent" with paymentUrl, so we can't roll that back
    // cleanly — instead we surface a clear 502 so the UI shows
    // the failure rather than silently pretending success. The
    // invoice can be re-sent (the existing paymentUrl is reused;
    // no new FireBuddy charge is created).
    console.error(`Invoice ${invoice.invoiceNumber}: payment link created but email failed to send`);
    return NextResponse.json(
      {
        error:
          "Payment link was created, but the email failed to send. Check the email provider (Mailcub) settings or your sender address, then click Send again to retry.",
        invoice: updatedInvoice,
        paymentUrl: result.paymentUrl,
        emailSent: false,
      },
      { status: 502 },
    );
  }

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "invoice.send",
    targetType: "invoice",
    targetId: invoiceId,
    meta: {
      invoiceNumber: invoice.invoiceNumber,
      to: customTo || invoice.clientEmail,
      cc: cc || undefined,
      total: invoice.total,
      currency: invoice.currency,
    },
    req,
  });

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
  clientAddress?: string | null;
  currency: string;
  bankTransfer?: boolean;
  dueDate: Date;
  createdAt: Date;
  subtotal: number;
  tax: number;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

interface BankDetails {
  accountName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  eurAccountName: string | null;
  iban: string | null;
  bic: string | null;
  instructions: string | null;
}

/** Build the "Pay by bank transfer" HTML block, or "" if the invoice
 *  isn't flagged for it / no matching account is configured. The block
 *  shown depends on the invoice currency: EUR invoices show the Euro
 *  account (IBAN/BIC), everything else shows the Sterling account
 *  (sort code/account number). The invoice number is the reference. */
function bankTransferBlock(
  invoice: InvoiceWithItems,
  bank: BankDetails | undefined,
): string {
  if (!invoice.bankTransfer || !bank) return "";

  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;font-weight:700;width:140px;">${label}</td><td style="padding:3px 0;font-size:13px;color:#222;">${escapeHtml(value)}</td></tr>`
      : "";

  const isEur = invoice.currency === "EUR";
  let rows = "";
  if (isEur) {
    if (!bank.iban && !bank.bic) return ""; // no Euro account configured
    rows =
      row("Account name", bank.eurAccountName || bank.accountName) +
      row("IBAN", bank.iban) +
      row("BIC / SWIFT", bank.bic);
  } else {
    if (!bank.sortCode && !bank.accountNumber) return ""; // no Sterling account
    rows =
      row("Account name", bank.accountName) +
      row("Sort code", bank.sortCode) +
      row("Account number", bank.accountNumber);
  }

  return `<div style="background:#f0f7ff;border:1px solid #cfe2ff;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1d4ed8;">Pay by bank transfer</p>
    <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:#444;">
      If you&rsquo;d prefer to pay directly into our bank account &mdash; or if
      you have any issues paying online with FireBuddy &mdash; you can use the
      details below.
    </p>
    <table style="border-collapse:collapse;">
      ${rows}
      ${row("Reference", invoice.invoiceNumber)}
    </table>
    ${bank.instructions ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#555;">${escapeHtml(bank.instructions).replace(/\n/g, "<br/>")}</p>` : ""}
  </div>`;
}

/**
 * Mirror a portal invoice into FireBuddy's Accounting → Invoices.
 * Idempotent — if the row already has a `firebuddyInvoiceId`, PATCH
 * the existing FireBuddy invoice instead of creating a duplicate
 * (re-sends should not create new accounting rows). Always sets
 * status="sent" on the FireBuddy side because we only call this
 * after the payment link is live and the email is about to go out.
 */
async function mirrorInvoiceToFireBuddy(
  invoice: {
    id: string;
    invoiceNumber: string;
    currency: string;
    clientName: string;
    clientEmail: string;
    createdAt: Date;
    dueDate: Date;
    notes: string | null;
    firebuddyInvoiceId: string | null;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
  },
  apiKey: string,
  paymentUrl: string,
): Promise<void> {
  const fb = new FireBuddy(apiKey);

  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  // FireBuddy's /invoices API expects amounts in the MAJOR currency
  // unit (pounds / euros), not pence/cents. Our DB stores everything
  // in pence as integers. Convert with toFixed(2) so we send a clean
  // 2-decimal-place number (e.g. 114 pence → 1.14). Tested 25-05-2026.
  const toMajor = (pence: number) => Number((pence / 100).toFixed(2));
  const items = invoice.items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unit_price: toMajor(it.unitPrice),
    amount: toMajor(it.amount),
  }));
  const currency = (invoice.currency || "GBP") as "EUR" | "GBP" | "USD";

  if (invoice.firebuddyInvoiceId) {
    // Re-send: refresh the payment link + ensure status is "sent".
    // Line items / client / dates can't be edited via PATCH; if the
    // invoice has been materially changed since the first send we'd
    // need to cancel + re-create — out of scope for the common case.
    await fb.updateInvoice(invoice.firebuddyInvoiceId, {
      payment_url: paymentUrl,
      payment_reference: invoice.invoiceNumber,
      status: "sent",
    });
    return;
  }

  const created = await fb.createInvoice({
    invoice_number: invoice.invoiceNumber,
    currency,
    client_name: invoice.clientName,
    client_email: invoice.clientEmail,
    issue_date: isoDate(invoice.createdAt),
    due_date: isoDate(invoice.dueDate),
    notes: invoice.notes ?? undefined,
    items,
    payment_url: paymentUrl,
    payment_reference: invoice.invoiceNumber,
    status: "sent",
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { firebuddyInvoiceId: created.id },
  });
}

function buildInvoiceEmail(params: {
  invoice: InvoiceWithItems;
  paymentUrl: string;
  personalNote?: string;
  bank?: BankDetails;
}): string {
  const { invoice, paymentUrl, personalNote, bank } = params;

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

    <!-- Header — Sensory Submarine logo above the dark band. Absolute
         URL so email clients fetch it; if a client blocks remote
         images, the dark text band below still reads as the header. -->
    <div style="text-align:center;padding:4px 0 12px;">
      <img src="https://portal.thesensorysubmarine.com/brand/logo.jpg"
           alt="The Sensory Submarine"
           width="96" height="96"
           style="display:inline-block;width:96px;height:auto;border:0;outline:none;" />
    </div>
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">The Sensory Submarine</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.7;">Occupational Therapy Services</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">

      <p style="margin:0 0 16px;font-size:15px;color:#222;">
        Hi ${escapeHtml(invoice.clientName)},
      </p>
      ${personalNote ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;font-style:italic;">${escapeHtml(personalNote).replace(/\n/g, "<br/>")}</p>` : ""}
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

      ${
        invoice.clientAddress
          ? `<!-- Bill to -->
      <div style="margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#888;">Bill to</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#222;">${escapeHtml(invoice.clientName)}</p>
        <p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:#555;">${escapeHtml(invoice.clientAddress).replace(/\n/g, "<br/>")}</p>
      </div>`
          : ""
      }

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
          <tr>
            <td colspan="3" style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#555;text-align:right;">
              Subtotal
            </td>
            <td style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#333;text-align:right;">
              ${formatPence(invoice.subtotal)}
            </td>
          </tr>
          ${invoice.tax > 0 ? `<tr>
            <td colspan="3" style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#555;text-align:right;">
              Tax
            </td>
            <td style="border:1px solid #e5e7eb;padding:8px 14px;font-size:13px;color:#333;text-align:right;">
              ${formatPence(invoice.tax)}
            </td>
          </tr>` : ""}
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

      <!-- Pay Now button — primary CTA, includes amount so the
           parent sees exactly what they're paying without having to
           re-scan the table. Bullet-proof inline styles for the
           widest email-client support. -->
      <div style="text-align:center;margin:0 0 12px;">
        <a href="${escapeHtml(paymentUrl)}"
           style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:18px 56px;border-radius:12px;font-weight:700;font-size:18px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(26,26,46,0.18);">
          Pay&nbsp;${formatPence(invoice.total)}&nbsp;now&nbsp;&rarr;
        </a>
      </div>
      <p style="text-align:center;margin:0 0 12px;font-size:12px;color:#888;">
        Secure payment via FireBuddy
      </p>

      <p style="margin:0 0 8px;font-size:12px;color:#777;">
        Or copy this link to pay:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#1a1a2e;word-break:break-all;">
        ${escapeHtml(paymentUrl)}
      </p>

      <!-- Bank transfer — placed below the pay button as a fallback. -->
      ${bankTransferBlock(invoice, bank)}

      <!-- Footer -->
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-align:center;">
        The Sensory Submarine &middot; Occupational Therapy Services
      </p>
      <p style="margin:0 0 8px;font-size:11px;color:#bbb;text-align:center;">
        If you have any questions about this invoice, please reply to this email.
      </p>
      <p style="margin:0;font-size:11px;color:#bbb;text-align:center;">
        Don't see our emails? Add The Sensory Submarine to your contacts, and
        check your junk/spam folder (marking us &ldquo;not junk&rdquo; helps
        future emails reach your inbox).
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
