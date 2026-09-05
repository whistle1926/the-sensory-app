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
 * configuration we can't see. Fire's own status is the truth: a payment
 * counts once the payer's bank has AUTHORISED it (see fire-payment-status),
 * so a bank flow that looked successful on screen but Fire never saw is
 * still correctly treated as pending.
 */
import { prisma } from "./prisma";
import { fetchFireStatus } from "./fire-payment-status";

export interface PaymentCheck {
  paid: boolean;
  /** Fire's own word for it, for logging and support. */
  fireStatus?: string;
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

  const check = await fetchFireStatus(purchase.paymentRef);
  if (!check.paid) return { paid: false, fireStatus: check.status };

  // Genuinely paid — complete it through the same path the webhook uses so
  // there is one definition of "what happens when someone pays".
  const { completeCoursePurchase } = await import("./course-purchase-complete");
  await completeCoursePurchase(purchase.id, purchase.paymentRef);
  return { paid: true, fireStatus: "paid" };
}
