/**
 * Is a Fire payment genuinely paid?
 *
 * Shared by courses and bookings so there is one answer to that question.
 * Fire's own record is the authority: we only treat money as received when
 * Fire has confirmed the funds, never because a bank flow looked successful
 * on screen. Grace's test payment reported "went through no bother" while
 * Fire had it as pending, never authorised.
 */
import { prisma } from "./prisma";
import { FireBuddy } from "./firebuddy";

export interface FireCheck {
  paid: boolean;
  /** Fire's own word, for support and logging. */
  status: string;
}

export function looksPaid(raw: unknown): boolean {
  const s = raw as {
    status?: string;
    settled?: boolean;
    funds_confirmed_at?: string | null;
  } | null;
  if (!s) return false;
  if (s.settled === true) return true;
  if (s.funds_confirmed_at) return true;
  const word = (s.status ?? "").toLowerCase();
  return word === "paid" || word === "completed" || word === "succeeded";
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
