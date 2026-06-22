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
  /**
   * Payments FireBuddy reports as completed but where the amount or
   * currency that landed does NOT match the invoice — e.g. a test
   * payment or an underpayment. We deliberately do NOT mark these paid;
   * they're surfaced so the OT can investigate.
   */
  mismatches: {
    invoiceNumber: string;
    expected: number;
    received: number;
    currency: string;
  }[];
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
    // paidMethod "fire" = confirmed landed in the Fire account (the
    // source of truth). Distinguishes these from manual cash/other marks.
    data: {
      status: "paid",
      paidAt: new Date(),
      paymentRef: paymentId,
      paidMethod: "fire",
    },
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
    return { checked: 0, synced: [], mismatches: [], errors: 0 };
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
      currency: true,
      paymentRef: true,
      firebuddyInvoiceId: true,
    },
  });

  const synced: { invoiceNumber: string; total: number }[] = [];
  const mismatches: ReconcileResult["mismatches"] = [];
  let errors = 0;

  for (const inv of invoices) {
    if (!inv.paymentRef) continue;
    try {
      const status = await fb.getPaymentStatus(inv.paymentRef);
      // Only "completed" payments count. Anything pending/failed is left
      // exactly as-is — never marked paid.
      if (status.status !== "completed") continue;

      // Truth guard: the money that actually landed must match the
      // invoice in BOTH amount and currency. This stops a test payment,
      // an underpayment, or a stray/mismatched payment-request from
      // flipping a full invoice to "paid". Fire is the source of truth —
      // if what landed doesn't equal what we billed, we don't trust it.
      const amountOk = status.amount === inv.total;
      const currencyOk =
        (status.currency || "").toUpperCase() ===
        (inv.currency || "GBP").toUpperCase();
      if (!amountOk || !currencyOk) {
        mismatches.push({
          invoiceNumber: inv.invoiceNumber,
          expected: inv.total,
          received: status.amount,
          currency: status.currency || inv.currency || "GBP",
        });
        console.warn(
          `[reconcile] ${inv.invoiceNumber}: completed payment does not match — expected ${inv.total} ${inv.currency}, got ${status.amount} ${status.currency}. NOT marking paid.`,
        );
        continue;
      }

      await markInvoicePaid(
        inv,
        status.fire_payment_code || inv.paymentRef,
        settings.apiKey,
      );
      synced.push({ invoiceNumber: inv.invoiceNumber, total: inv.total });
    } catch (err) {
      errors += 1;
      console.error(
        `[reconcile] status check failed for ${inv.invoiceNumber}:`,
        err,
      );
    }
  }

  return { checked: invoices.length, synced, mismatches, errors };
}
