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

/** Pull the invoice id out of a Fire transaction reference, e.g.
 *  "invoice:abc123" or "invoicecmpx…" → the id portion. */
function invoiceIdFromReference(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(/invoice:?([a-z0-9]+)/i);
  return m ? m[1] : null;
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
  let transactions;
  try {
    // Fire signs each request with a one-time nonce, so concurrent calls
    // collide ("nonce already used"). Call them sequentially.
    accounts = await fb.getAccounts();
    transactions = await fb.getTransactions();
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

  // Pre-load the invoices referenced so we can attach number + client.
  const ids = Array.from(
    new Set(
      incoming
        .map((t) => invoiceIdFromReference(t.reference))
        .filter((x): x is string => !!x),
    ),
  );
  const invoices = ids.length
    ? await prisma.invoice.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          total: true,
          currency: true,
        },
      })
    : [];
  const byId = new Map(invoices.map((i) => [i.id, i]));

  const payments: ReceivedPayment[] = incoming
    .map((t) => {
      const id = invoiceIdFromReference(t.reference);
      const inv = id ? byId.get(id) : undefined;
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
