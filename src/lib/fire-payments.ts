/**
 * Read-only "Payments received" reconciliation.
 *
 * Source of truth = the REAL transactions on the Fire account (money that
 * actually landed), NOT payment-request "completed" status (which can lie).
 * We pull Fire's `/transactions`, keep the money-IN movements, and match
 * each to a portal invoice by reference + amount. Nothing is written back
 * to invoices — the portal never asserts paid; this just mirrors Fire.
 */
import { prisma } from "@/lib/prisma";
import { FireBuddy, type FireAccount } from "@/lib/firebuddy";

export interface ReceivedPayment {
  txnId: number;
  date: string;
  amountPence: number;
  currency: string;
  reference: string | null;
  description: string | null;
  /** Matched invoice, if the lodgement reference points at one. */
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  /** True when a matched invoice's amount + currency equal the lodgement. */
  amountMatches: boolean;
}

export interface FirePaymentsResult {
  configured: boolean;
  accounts: FireAccount[];
  payments: ReceivedPayment[];
  error?: string;
}

/** Pull the invoice-id fragment out of a Fire transaction reference, e.g.
 *  "invoice:abc123" or "invoicecmpx…" → the id portion. Fire TRUNCATES
 *  references (~18 chars), so this is a PREFIX of the real invoice id —
 *  match with startsWith, not equality. */
function invoiceFragmentFromReference(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(/invoice:?([a-z0-9]+)/i);
  // Require a few chars so a stray short fragment can't false-match.
  return m && m[1].length >= 6 ? m[1] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fire signs each request with a one-time, time-based nonce. Two calls
 * close together (likely from Vercel, which sits right next to the proxy)
 * can land on the same nonce → "nonce already used". Retry GET reads a
 * couple of times with a >1s gap so a fresh nonce is generated. Safe for
 * idempotent reads only.
 */
async function withNonceRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/nonce/i.test(msg)) {
        await sleep(1300);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function getFirePaymentsReceived(): Promise<FirePaymentsResult> {
  const settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
    select: { enabled: true, apiKey: true },
  });
  if (!settings?.enabled || !settings.apiKey) {
    return { configured: false, accounts: [], payments: [] };
  }

  const fb = new FireBuddy(settings.apiKey);
  let accounts: FireAccount[] = [];
  const transactions = [];
  try {
    // Sequential + spaced + retry: each call needs its own fresh nonce.
    accounts = await withNonceRetry(() => fb.getAccounts());
    // The plain /transactions endpoint only returns ONE account's
    // movements, so query EACH account (by ICAN) and combine — otherwise
    // we'd miss everything that landed in the other account(s).
    for (const acc of accounts) {
      await sleep(1300);
      const txns = await withNonceRetry(() => fb.getTransactions(acc.ican));
      transactions.push(...txns);
    }
  } catch (err) {
    return {
      configured: true,
      accounts: [],
      payments: [],
      error: err instanceof Error ? err.message : "Failed to reach Fire",
    };
  }

  // Money IN only — that's the definition of "received".
  const incoming = transactions.filter((t) => t.direction === "IN");

  // Load all live invoices once and match by id PREFIX (Fire truncates
  // the reference, so it's a prefix of the real cuid). Small set, so a
  // linear scan is fine and avoids fragile `in` queries.
  const invoices = await prisma.invoice.findMany({
    where: { status: { not: "cancelled" } },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      total: true,
      currency: true,
    },
  });
  function matchInvoice(ref: string | null) {
    const frag = invoiceFragmentFromReference(ref);
    if (!frag) return undefined;
    return invoices.find((i) => i.id.startsWith(frag));
  }

  const payments: ReceivedPayment[] = incoming
    .map((t) => {
      const inv = matchInvoice(t.reference);
      const amountPence = Math.round((t.amount ?? 0) * 100);
      return {
        txnId: t.txnId,
        date: t.date,
        amountPence,
        currency: t.currency,
        reference: t.reference,
        description: t.description,
        invoiceId: inv?.id ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        clientName: inv?.clientName ?? null,
        amountMatches: inv
          ? amountPence === inv.total &&
            (t.currency || "").toUpperCase() ===
              (inv.currency || "GBP").toUpperCase()
          : false,
      };
    })
    // Newest first.
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { configured: true, accounts, payments };
}
