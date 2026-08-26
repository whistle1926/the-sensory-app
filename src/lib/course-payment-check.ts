/**
 * Ask Fire directly whether a course payment has completed.
 *
 * We used to rely solely on Fire's webhook. It has never once completed a
 * purchase, for a reason that only showed up by reading what Fire stored:
 * our reference "course:<id>" comes back as "coursecmt9ruhil000" — colon
 * stripped, truncated to 18 characters — so the webhook's `startsWith
 * ("course:")` routing could never match. A parent paid and sat on "still
 * processing" for ever.
 *
 * Asking Fire is authoritative and needs no webhook, no reference and no
 * configuration we can't see. Fire's own status is the truth: only funds
 * actually confirmed count as paid, so a bank flow that looked successful
 * but hasn't settled is still correctly treated as pending.
 */
import { prisma } from "./prisma";
import { FireBuddy } from "./firebuddy";

export interface PaymentCheck {
  paid: boolean;
  /** Fire's own word for it, for logging and support. */
  fireStatus?: string;
}

/** True when Fire considers the money genuinely received. */
function looksPaid(status: unknown): boolean {
  const s = status as {
    status?: string;
    settled?: boolean;
    funds_confirmed_at?: string | null;
    authorised_at?: string | null;
  } | null;
  if (!s) return false;
  if (s.settled === true) return true;
  if (s.funds_confirmed_at) return true;
  const word = (s.status ?? "").toLowerCase();
  return word === "paid" || word === "completed" || word === "succeeded";
}

/**
 * Check a pending purchase against Fire and, if the money is really there,
 * complete it exactly as the webhook would.
 */
export async function checkCoursePayment(purchaseId: string): Promise<PaymentCheck> {
  const purchase = await prisma.coursePurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, paymentStatus: true, paymentRef: true, groupId: true },
  });
  if (!purchase) return { paid: false };
  if (purchase.paymentStatus === "paid") return { paid: true, fireStatus: "already paid" };
  if (!purchase.paymentRef) return { paid: false, fireStatus: "no payment started" };

  const settings = await prisma.paymentSettings.findFirst({ select: { apiKey: true, enabled: true } });
  if (!settings?.enabled || !settings.apiKey) return { paid: false, fireStatus: "payments not configured" };

  try {
    const fb = new FireBuddy(settings.apiKey);
    const status = await fb.getPaymentStatus(purchase.paymentRef);
    if (!looksPaid(status)) {
      return {
        paid: false,
        fireStatus: (status as { status?: string })?.status ?? "unknown",
      };
    }

    // Genuinely paid — complete it through the same path the webhook uses so
    // there is one definition of "what happens when someone pays".
    const { completeCoursePurchase } = await import("./course-purchase-complete");
    await completeCoursePurchase(purchase.id, purchase.paymentRef);
    return { paid: true, fireStatus: "paid" };
  } catch (err) {
    console.error("[course-payment-check] Fire lookup failed:", err);
    return { paid: false, fireStatus: "could not reach Fire" };
  }
}
