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
  /** What the payment was matched to (invoice, booking, course), or a
   *  "possible" name match for a bank transfer with a free-text reference. */
  matchKind: "invoice" | "booking" | "course" | "possible" | null;
  /** Short label for what it paid for, e.g. "INV-0182" or "Block of OT". */
  forLabel: string | null;
  /** Where to click through to, if anywhere. */
  href: string | null;
}

export interface FirePaymentsResult {
  configured: boolean;
  accounts: FireAccount[];
  payments: ReceivedPayment[];
  error?: string;
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

  // Load the portal records once and match each lodgement by its
  // reference. Fire strips punctuation and TRUNCATES references (~18
  // chars), so ids are matched by PREFIX after normalising. Small sets,
  // so linear scans are fine.
  const [invoices, bookings, purchases, services] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { not: "cancelled" } },
      select: { id: true, invoiceNumber: true, clientName: true, total: true, currency: true },
    }),
    prisma.booking.findMany({
      select: { id: true, groupId: true, clientName: true, service: true, price: true, status: true },
      take: 10000,
    }),
    prisma.coursePurchase.findMany({
      select: {
        id: true,
        groupId: true,
        amount: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
      take: 10000,
    }),
    prisma.bookingService.findMany({ select: { slug: true, title: true } }),
  ]);
  const serviceTitle = new Map(services.map((sv) => [sv.slug, sv.title]));
  const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  type Match = Pick<ReceivedPayment, "invoiceId" | "invoiceNumber" | "clientName" | "matchKind" | "forLabel" | "href"> & { expectedPence?: number; currency?: string };

  function invoiceMatch(inv: (typeof invoices)[number]): Match {
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      matchKind: "invoice",
      forLabel: inv.invoiceNumber,
      href: `/invoices/${inv.id}`,
      expectedPence: inv.total,
      currency: inv.currency || "GBP",
    };
  }
  function bookingMatch(rows: (typeof bookings)): Match | undefined {
    if (rows.length === 0) return undefined;
    const b = rows[0];
    const title = serviceTitle.get(b.service) ?? b.service;
    return {
      invoiceId: null,
      invoiceNumber: null,
      clientName: b.clientName,
      matchKind: "booking",
      forLabel: rows.length > 1 ? `${title} (${rows.length} sessions)` : title,
      href: `/bookings?booking=${b.id}`,
      expectedPence: rows.reduce((t, r) => t + (r.price ?? 0), 0),
    };
  }
  function courseMatch(rows: (typeof purchases)): Match | undefined {
    if (rows.length === 0) return undefined;
    const c = rows[0];
    return {
      invoiceId: null,
      invoiceNumber: null,
      clientName: c.user?.name || c.user?.email || null,
      matchKind: "course",
      forLabel: rows.length > 1 ? `${rows.length} courses` : c.course?.title ?? "Course",
      href: null,
      // Course amounts are stored in whole pounds.
      expectedPence: rows.reduce((t, r) => t + (r.amount ?? 0) * 100, 0),
    };
  }

  // Free-text bank transfers ("Sacred heart ps"): suggest a record whose
  // name shares words with the reference. Only a suggestion — flagged as
  // "possible" so nobody mistakes it for a confirmed match.
  const STOP = new Set(["primary", "school", "nursery", "the", "and", "payment", "invoice", "lodgement", "thanks", "ltd"]);
  const words = (v: string | null | undefined) =>
    (v ?? "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  const nameCandidates = [
    ...invoices.map((i) => ({ name: i.clientName, pence: i.total, m: () => invoiceMatch(i) })),
    ...bookings.filter((b) => b.status !== "cancelled").map((b) => ({ name: b.clientName, pence: b.price ?? 0, m: () => bookingMatch([b])! })),
  ];
  function possibleMatch(ref: string, pence: number): Match | undefined {
    const refWords = new Set(words(ref));
    if (refWords.size === 0) return undefined;
    let best: { score: number; m: () => Match } | undefined;
    for (const c of nameCandidates) {
      const overlap = words(c.name).filter((w) => refWords.has(w)).length;
      if (overlap === 0) continue;
      const sameAmount = c.pence === pence;
      if (!sameAmount && overlap < 2) continue;
      const score = overlap * 2 + (sameAmount ? 3 : 0);
      if (!best || score > best.score) best = { score, m: c.m };
    }
    if (!best) return undefined;
    const m = best.m();
    return { ...m, invoiceId: null, matchKind: "possible" };
  }

  function match(ref: string | null, pence: number): Match | undefined {
    const r = norm(ref);
    if (!r) return undefined;
    let mm: RegExpMatchArray | null;
    // invoice:<id>
    if ((mm = r.match(/^invoice([a-z0-9]{6,})/))) {
      const inv = invoices.find((i) => i.id.startsWith(mm![1]));
      if (inv) return invoiceMatch(inv);
    }
    // courseGroup:<uuid> / course:<id>
    if ((mm = r.match(/^coursegroup([a-z0-9]{6,})/))) {
      const frag = mm[1];
      const m = courseMatch(purchases.filter((p) => p.groupId && norm(p.groupId).startsWith(frag)));
      if (m) return m;
    }
    if ((mm = r.match(/^course([a-z0-9]{6,})/))) {
      const frag = mm[1];
      const m = courseMatch(purchases.filter((p) => p.id.startsWith(frag)));
      if (m) return m;
    }
    // group:<uuid> (a block of booked sessions)
    if ((mm = r.match(/^group([a-z0-9]{6,})/))) {
      const frag = mm[1];
      const m = bookingMatch(bookings.filter((b) => b.groupId && norm(b.groupId).startsWith(frag)));
      if (m) return m;
    }
    // A bare id — a single booking's payment link.
    if (/^c[a-z0-9]{9,}$/.test(r)) {
      const b = bookings.filter((x) => x.id.startsWith(r));
      if (b.length === 1) return bookingMatch(b);
      const inv = invoices.find((i) => i.id.startsWith(r));
      if (inv) return invoiceMatch(inv);
    }
    // A bank transfer quoting the invoice number ("INV-0172", "Inv 0184").
    if ((mm = r.match(/inv0*(\d{1,6})/))) {
      const n = Number(mm[1]);
      const inv = invoices.find((i) => {
        const d = i.invoiceNumber.match(/(\d+)/);
        return d && Number(d[1]) === n;
      });
      if (inv) return invoiceMatch(inv);
    }
    // Just the number ("0144") — only trusted when the amount agrees too.
    if ((mm = r.match(/^0\d{2,5}$/))) {
      const n = Number(r);
      const inv = invoices.find((i) => {
        const d = i.invoiceNumber.match(/(\d+)/);
        return d && Number(d[1]) === n && i.total === pence;
      });
      if (inv) return invoiceMatch(inv);
    }
    return possibleMatch(ref ?? "", pence);
  }

  const payments: ReceivedPayment[] = incoming
    .map((t) => {
      const amountPence = Math.round((t.amount ?? 0) * 100);
      const m = match(t.reference, amountPence);
      return {
        txnId: t.txnId,
        date: t.date,
        amountPence,
        currency: t.currency,
        reference: t.reference,
        description: t.description,
        invoiceId: m?.invoiceId ?? null,
        invoiceNumber: m?.invoiceNumber ?? null,
        clientName: m?.clientName ?? null,
        matchKind: m?.matchKind ?? null,
        forLabel: m?.forLabel ?? null,
        href: m?.href ?? null,
        amountMatches:
          m && m.matchKind !== "possible" && m.expectedPence != null
            ? amountPence === m.expectedPence &&
              (!m.currency ||
                (t.currency || "").toUpperCase() === m.currency.toUpperCase())
            : false,
      };
    })
    // Newest first.
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { configured: true, accounts, payments };
}

/**
 * Mirror the real Fire payments into the private income tracker so the
 * dashboard revenue reflects money that ACTUALLY landed (the source of
 * truth), self-correcting as new payments arrive. Idempotent: upserts an
 * IncomeEntry per matched invoice payment keyed on (source, reference),
 * stamping the REAL Fire transaction date as occurredAt. Run from the
 * daily fire-payments cron. Returns how many entries were written.
 */
export async function syncFireIncomeToTracker(): Promise<{ synced: number }> {
  const result = await getFirePaymentsReceived();
  if (!result.configured || result.error) return { synced: 0 };

  let synced = 0;
  for (const p of result.payments) {
    // Only payments matched to an invoice with the full amount count as
    // income — top-ups / mismatches are left out.
    if (!p.invoiceId || !p.amountMatches) continue;
    const occurredAt = new Date(p.date);
    const description = p.invoiceNumber
      ? `${p.invoiceNumber} — ${p.clientName ?? ""}`.trim()
      : "Fire payment";
    try {
      await prisma.incomeEntry.upsert({
        where: {
          source_reference: { source: "INVOICE", reference: p.invoiceId },
        },
        update: { amount: p.amountPence, occurredAt, description },
        create: {
          source: "INVOICE",
          reference: p.invoiceId,
          amount: p.amountPence,
          occurredAt,
          description,
        },
      });
      synced++;
    } catch (err) {
      console.error("[fire-income] upsert failed for", p.invoiceNumber, err);
    }
  }
  return { synced };
}
