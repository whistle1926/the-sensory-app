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
  /**
   * Invoices flipped to paid by matching a MANUAL bank transfer that
   * landed in the Fire account directly (not through the payment link),
   * identified by the invoice number in the transfer reference plus an
   * exact amount match. Reported separately so it's clear these were
   * BACS/standing-order payments, not link payments.
   */
  bankMatched: { invoiceNumber: string; total: number; reference: string }[];
  errors: number;
}

/** Normalise a reference or invoice number for loose comparison:
 *  uppercase, strip everything but letters and digits. So "INV-0136",
 *  "inv0136" and "Appletree/Inv0136" all reduce to something we can
 *  substring-test against. */
function normaliseRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    return { checked: 0, synced: [], mismatches: [], bankMatched: [], errors: 0 };
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
      //
      // UNITS: FireBuddy's payment-request `amount` is in major units
      // (pounds), e.g. 100 = £100.00, 1.14 = £1.14. Our invoice.total is
      // in pence. Convert before comparing.
      const receivedPence = Math.round((status.amount ?? 0) * 100);
      const amountOk = receivedPence === inv.total;
      const currencyOk =
        (status.currency || "").toUpperCase() ===
        (inv.currency || "GBP").toUpperCase();
      if (!amountOk || !currencyOk) {
        mismatches.push({
          invoiceNumber: inv.invoiceNumber,
          expected: inv.total,
          received: receivedPence,
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

  // Second pass: manual bank transfers that landed straight in the Fire
  // account (no payment-request, so the loop above can't see them). Match
  // any still-unpaid invoice to an incoming transaction by invoice number
  // + exact amount. Runs on the same invoice set, minus the ones we just
  // synced.
  const syncedNumbers = new Set(synced.map((x) => x.invoiceNumber));
  const stillOpen = invoices.filter((i) => !syncedNumbers.has(i.invoiceNumber));
  const bankMatched = await matchBankTransfers(fb, stillOpen, settings.apiKey);

  return { checked: invoices.length, synced, mismatches, bankMatched, errors };
}

/**
 * Match still-unpaid invoices against real incoming Fire transactions —
 * the manual bank-transfer case. A parent or school that pays by BACS
 * instead of the payment link lands money in the Fire account with a
 * free-text reference (they usually type the invoice number). There's no
 * payment-request to poll, so this reads the account's actual movements
 * and pairs them up.
 *
 * Safety: we require BOTH the invoice number to appear in the transfer
 * reference AND the amount to match to the penny AND the currency to
 * match. Amount alone is never enough (many invoices share a price), and
 * a reference without the number is left for manual review. Each Fire
 * transaction is consumed once, so two invoices can't claim the same
 * lodgement.
 */
async function matchBankTransfers(
  fb: FireBuddy,
  openInvoices: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    total: number;
    currency: string;
    firebuddyInvoiceId: string | null;
  }[],
  apiKey: string,
): Promise<ReconcileResult["bankMatched"]> {
  const matched: ReconcileResult["bankMatched"] = [];
  if (openInvoices.length === 0) return matched;

  // Pull incoming movements across every Fire account (one per currency).
  let accounts: { ican: number; currency: string }[] = [];
  try {
    accounts = await fb.getAccounts();
  } catch (err) {
    console.error("[reconcile] getAccounts failed:", err);
    return matched;
  }

  interface InTxn { txnId: number; amountPence: number; currency: string; ref: string; }
  const incoming: InTxn[] = [];
  for (const acct of accounts) {
    try {
      const txns = await fb.getTransactions(acct.ican);
      for (const t of txns) {
        if (t.direction !== "IN") continue;
        incoming.push({
          txnId: t.txnId,
          amountPence: Math.round((t.amount ?? 0) * 100),
          currency: (t.currency || acct.currency || "GBP").toUpperCase(),
          ref: normaliseRef(t.reference ?? ""),
        });
      }
    } catch (err) {
      console.error(`[reconcile] getTransactions(${acct.ican}) failed:`, err);
    }
  }
  if (incoming.length === 0) return matched;

  const usedTxn = new Set<number>();

  for (const inv of openInvoices) {
    const normNo = normaliseRef(inv.invoiceNumber); // e.g. "INV0136"
    const digits = normNo.replace(/[^0-9]/g, ""); // e.g. "0136"
    const wantCurrency = (inv.currency || "GBP").toUpperCase();

    const hit = incoming.find((t) => {
      if (usedTxn.has(t.txnId)) return false;
      if (t.amountPence !== inv.total) return false;
      if (t.currency !== wantCurrency) return false;
      // The invoice number must appear in the reference. Prefer the full
      // "INV0136"; fall back to the 4+ digit core so "0144" or
      // "PLAYBOARDINV0149" still match, without matching a bare "1".
      if (t.ref.includes(normNo)) return true;
      if (digits.length >= 4 && t.ref.includes(digits)) return true;
      return false;
    });
    if (!hit) continue;

    usedTxn.add(hit.txnId);
    try {
      await prisma.invoice.update({
        where: { id: inv.id },
        // Confirmed landed in the Fire account, but as a manual transfer
        // rather than a link payment — tag it so the row reads honestly.
        data: {
          status: "paid",
          paidAt: new Date(),
          paymentRef: `fire-txn:${hit.txnId}`,
          paidMethod: "bank_transfer",
        },
      });
      if (inv.firebuddyInvoiceId) {
        try {
          await fb.updateInvoice(inv.firebuddyInvoiceId, { status: "paid" });
        } catch (err) {
          console.error("[reconcile] FireBuddy status patch (bank) failed:", err);
        }
      }
      if (inv.total > 0) {
        await prisma.incomeEntry.upsert({
          where: { source_reference: { source: "INVOICE", reference: inv.id } },
          update: { amount: inv.total, description: `${inv.invoiceNumber} — ${inv.clientName}` },
          create: {
            amount: inv.total,
            source: "INVOICE",
            reference: inv.id,
            description: `${inv.invoiceNumber} — ${inv.clientName}`,
            occurredAt: new Date(),
          },
        });
      }
      matched.push({
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        reference: hit.ref,
      });
    } catch (err) {
      console.error(`[reconcile] bank-match update failed for ${inv.invoiceNumber}:`, err);
    }
  }

  return matched;
}
