/**
 * Pull-based invoice payment sync.
 *
 * FireBuddy is supposed to call our webhook when a payment-request
 * completes, but in practice that's been unreliable (webhook not
 * registered / event mismatch / signature). Rather than depend on
 * FireBuddy calling us, this asks FireBuddy directly for the status of
 * every unpaid invoice's payment-request and marks the portal invoice
 * paid when FireBuddy reports "completed".
 *
 * Used by:
 *   - the "Sync with FireBuddy" button on the invoices page (instant,
 *     on-demand), and
 *   - a periodic cron (automatic backstop).
 *
 * Idempotent: an already-paid invoice is skipped; the income credit is
 * an upsert keyed on (source, reference).
 */
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";

export interface ReconcileResult {
  checked: number;
  synced: { invoiceNumber: string; total: number }[];
  errors: number;
}

/**
 * Apply the paid transition + side effects to a single invoice. Mirrors
 * what the webhook's handleInvoicePayment does so both paths converge on
 * the same final state.
 */
async function markInvoicePaid(
  invoice: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    total: number;
    firebuddyInvoiceId: string | null;
  },
  paymentId: string,
  apiKey: string,
): Promise<void> {
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "paid", paidAt: new Date(), paymentRef: paymentId },
  });

  // Reflect the paid status onto the mirrored FireBuddy accounting
  // invoice (best-effort — payment is already recorded locally).
  if (invoice.firebuddyInvoiceId) {
    try {
      const fb = new FireBuddy(apiKey);
      await fb.updateInvoice(invoice.firebuddyInvoiceId, { status: "paid" });
    } catch (err) {
      console.error("[reconcile] FireBuddy invoice status patch failed:", err);
    }
  }

  // Credit the private income tracker (idempotent on source+reference).
  if (invoice.total > 0) {
    try {
      await prisma.incomeEntry.upsert({
        where: { source_reference: { source: "INVOICE", reference: invoice.id } },
        update: {
          amount: invoice.total,
          description: `${invoice.invoiceNumber} — ${invoice.clientName}`,
        },
        create: {
          amount: invoice.total,
          source: "INVOICE",
          reference: invoice.id,
          description: `${invoice.invoiceNumber} — ${invoice.clientName}`,
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[reconcile] income credit failed:", err);
    }
  }
}

/**
 * Poll FireBuddy for every unpaid invoice that has a payment-request
 * code and mark the completed ones paid. Returns a summary.
 */
export async function reconcileInvoicePayments(): Promise<ReconcileResult> {
  const settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
    select: { enabled: true, apiKey: true },
  });
  if (!settings?.enabled || !settings.apiKey) {
    return { checked: 0, synced: [], errors: 0 };
  }

  const fb = new FireBuddy(settings.apiKey);

  // Candidates: have a FireBuddy payment-request code and aren't already
  // settled/cancelled.
  const invoices = await prisma.invoice.findMany({
    where: {
      paymentRef: { not: null },
      status: { notIn: ["paid", "cancelled"] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      total: true,
      paymentRef: true,
      firebuddyInvoiceId: true,
    },
  });

  const synced: { invoiceNumber: string; total: number }[] = [];
  let errors = 0;

  for (const inv of invoices) {
    if (!inv.paymentRef) continue;
    try {
      const status = await fb.getPaymentStatus(inv.paymentRef);
      if (status.status === "completed") {
        await markInvoicePaid(
          inv,
          status.fire_payment_code || inv.paymentRef,
          settings.apiKey,
        );
        synced.push({ invoiceNumber: inv.invoiceNumber, total: inv.total });
      }
    } catch (err) {
      errors += 1;
      console.error(
        `[reconcile] status check failed for ${inv.invoiceNumber}:`,
        err,
      );
    }
  }

  return { checked: invoices.length, synced, errors };
}
