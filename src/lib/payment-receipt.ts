/**
 * "Payment received" receipts (Claire, Nov 2026): emailed to the client
 * once an invoice is paid — via Fire (webhook / sweep / bank-transfer match)
 * or marked paid by staff — and, optionally, when staff mark a booking paid.
 *
 * Idempotent on receiptSentAt so the webhook and the 5-minute sweep racing
 * each other can't send two. Best-effort: never throws, so a mail problem
 * can't undo or block recording the payment.
 */
import { prisma } from "@/lib/prisma";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";

const METHOD_LABEL: Record<string, string> = {
  fire: "Online payment",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  other: "Payment",
};

function money(pence: number, currency = "GBP"): string {
  return (pence / 100).toLocaleString("en-GB", { style: "currency", currency });
}

function day(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function receiptHtml(args: {
  name: string;
  lines: Array<{ label: string; amount: string }>;
  total: string;
  paidOn: Date;
  method: string | null;
  reference: string;
}): string {
  const first = args.name.split(" ")[0] || "there";
  const rows = args.lines
    .map(
      (l) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(l.label)}</td>
  <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${l.amount}</td>
</tr>`,
    )
    .join("");
  return brandedEmail({
    heading: "Payment received — thank you",
    bodyHtml: `
<p style="margin:0 0 14px;">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 18px;">Thanks — we've received your payment. Here's your receipt for your records.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 6px;">
  ${rows}
  <tr>
    <td style="padding:10px 0 0;font-weight:700;">Total paid</td>
    <td style="padding:10px 0 0;text-align:right;font-weight:700;">${args.total}</td>
  </tr>
</table>
<p style="margin:18px 0 0;font-size:13px;color:#666;">
  Paid on ${day(args.paidOn)}${args.method ? ` · ${escapeHtml(METHOD_LABEL[args.method] ?? "Payment")}` : ""}<br/>
  Reference: ${escapeHtml(args.reference)}
</p>
<p style="margin:18px 0 0;"><strong>The Sensory Submarine</strong></p>`,
  });
}

/** Email the receipt for a paid invoice. Returns true if it went out. */
export async function sendInvoiceReceipt(invoiceId: string): Promise<boolean> {
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!inv || inv.status !== "paid" || inv.receiptSentAt || !inv.clientEmail) return false;
    // Claim it first, so a racing webhook + sweep send only one.
    const claimed = await prisma.invoice.updateMany({
      where: { id: inv.id, receiptSentAt: null },
      data: { receiptSentAt: new Date() },
    });
    if (claimed.count === 0) return false;

    const res = await sendTransactionalEmail({
      to: inv.clientEmail,
      subject: `Receipt for invoice ${inv.invoiceNumber} — The Sensory Submarine`,
      html: receiptHtml({
        name: inv.clientName,
        lines: inv.items.length
          ? inv.items.map((i) => ({
              label: i.quantity > 1 ? `${i.description} × ${i.quantity}` : i.description,
              amount: money(i.amount, inv.currency),
            }))
          : [{ label: `Invoice ${inv.invoiceNumber}`, amount: money(inv.total, inv.currency) }],
        total: money(inv.total, inv.currency),
        paidOn: inv.paidAt ?? new Date(),
        method: inv.paidMethod,
        reference: inv.invoiceNumber,
      }),
    });
    if (!res.ok) {
      // Let a later attempt try again.
      await prisma.invoice.update({ where: { id: inv.id }, data: { receiptSentAt: null } });
      console.error("[receipt] invoice email failed:", inv.invoiceNumber, res);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[receipt] invoice receipt failed:", invoiceId, err);
    return false;
  }
}

/** Email the receipt for a booking (or a whole block) marked paid. */
export async function sendBookingReceipt(bookingId: string): Promise<boolean> {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.paymentStatus !== "paid" || !booking.clientEmail) return false;
    const sessions = booking.groupId
      ? await prisma.booking.findMany({
          where: { groupId: booking.groupId },
          orderBy: [{ date: "asc" }, { time: "asc" }],
        })
      : [booking];
    if (sessions.some((s) => s.receiptSentAt)) return false;
    const ids = sessions.map((s) => s.id);
    const claimed = await prisma.booking.updateMany({
      where: { id: { in: ids }, receiptSentAt: null },
      data: { receiptSentAt: new Date() },
    });
    if (claimed.count === 0) return false;

    const svc = await prisma.bookingService.findUnique({
      where: { slug: booking.service },
      select: { title: true },
    });
    const title = svc?.title ?? booking.service;
    const total = sessions.reduce((sum, s) => sum + s.price, 0);
    const res = await sendTransactionalEmail({
      to: booking.clientEmail,
      subject: `Receipt for ${title} — The Sensory Submarine`,
      html: receiptHtml({
        name: booking.clientName,
        lines: [
          {
            label:
              sessions.length > 1
                ? `${title} — ${sessions.length} sessions (${sessions.map((s) => day(s.date)).join(", ")})`
                : `${title} — ${day(booking.date)} at ${booking.time}`,
            amount: money(total),
          },
        ],
        total: money(total),
        paidOn: booking.paidAt ?? new Date(),
        method: booking.paidMethod,
        reference: booking.paymentRef ?? booking.id.slice(-8).toUpperCase(),
      }),
    });
    if (!res.ok) {
      await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { receiptSentAt: null } });
      console.error("[receipt] booking email failed:", booking.id, res);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[receipt] booking receipt failed:", bookingId, err);
    return false;
  }
}
