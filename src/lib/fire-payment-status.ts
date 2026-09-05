/**
 * Is a Fire payment good enough to grant what was bought?
 *
 * Shared by courses and bookings so there is one answer to that question.
 * Fire's own record is the authority — never a bank flow that merely looked
 * successful on screen. Grace's test payment reported "went through no
 * bother" while Fire had it as pending, never authorised.
 *
 * The bar is AUTHORISED, not settled. Open banking has two moments: the
 * payer's bank authorises the payment (seconds — the money has left their
 * account and the instruction is committed), and Fire confirms the funds
 * have landed (anything from minutes to eight hours). Grace paid at 11:50,
 * Fire had it authorised at 11:50:46, and funds_confirmed_at was still null
 * at lunchtime. Making a buyer wait for the second moment means paying and
 * then staring at "still processing" — so access is granted on the first.
 * The "Payments received" view still reads real account transactions, so
 * the books only ever show money that has actually landed.
 *
 * A payment that Fire has since failed, abandoned or cancelled never counts,
 * even if it carries an authorised_at from earlier in its life.
 */
import { prisma } from "./prisma";
import { FireBuddy } from "./firebuddy";

export interface FireCheck {
  paid: boolean;
  /** Fire's own word, for support and logging. */
  status: string;
}

const DEAD_STATUSES = new Set([
  "failed",
  "abandoned",
  "cancelled",
  "canceled",
  "rejected",
  "expired",
  "declined",
]);

export function looksPaid(raw: unknown): boolean {
  const s = raw as {
    status?: string;
    settled?: boolean;
    funds_confirmed_at?: string | null;
    authorised_at?: string | null;
  } | null;
  if (!s) return false;
  const word = (s.status ?? "").toLowerCase();
  if (DEAD_STATUSES.has(word)) return false;
  if (s.settled === true) return true;
  if (s.funds_confirmed_at) return true;
  if (s.authorised_at) return true;
  return word === "paid" || word === "completed" || word === "succeeded" || word === "authorised" || word === "authorized";
}

/** Ask Fire about one payment code. Never throws. */
export async function fetchFireStatus(paymentRef: string): Promise<FireCheck> {
  const settings = await prisma.paymentSettings.findFirst({
    select: { apiKey: true, enabled: true },
  });
  if (!settings?.enabled || !settings.apiKey) {
    return { paid: false, status: "payments not configured" };
  }
  try {
    const raw = await new FireBuddy(settings.apiKey).getPaymentStatus(paymentRef);
    return {
      paid: looksPaid(raw),
      status: (raw as { status?: string })?.status ?? "unknown",
    };
  } catch (err) {
    console.error("[fire] status lookup failed:", err);
    return { paid: false, status: "could not reach Fire" };
  }
}
