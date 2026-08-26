/**
 * What happens when a course payment completes.
 *
 * Lifted out of the webhook so there is ONE definition of "someone has paid":
 * the webhook uses it, and so does the direct check against Fire that the
 * thanks page relies on. Two copies of this would eventually disagree about
 * whether someone is enrolled.
 *
 * Idempotent — it returns immediately if the purchase is already paid, so
 * the webhook and the poll racing each other is harmless.
 */
import { prisma } from "./prisma";
import { ensureEnrollment } from "./course-enrollment";
import { sendCoursePurchaseEmail } from "./course-purchase-email";

export async function completeCoursePurchase(purchaseId: string, paymentId: string) {
  const purchase = await prisma.coursePurchase.findUnique({
    where: { id: purchaseId },
    include: { course: { select: { id: true, title: true } } },
  });
  if (!purchase) {
    console.warn("[purchase] course purchase not found:", purchaseId);
    return;
  }

  // Idempotent short-circuit — webhook can fire twice, or the returning user
  // can race the webhook. Only mutate on the first "paid" transition.
  if (purchase.paymentStatus === "paid") return;

  await prisma.coursePurchase.update({
    where: { id: purchaseId },
    data: {
      paymentStatus: "paid",
      paymentRef: paymentId,
      completedAt: new Date(),
    },
  });

  // Seed the enrolment (idempotent — ensureEnrollment no-ops if it exists).
  try {
    await ensureEnrollment(purchase.userId, purchase.courseId);
  } catch (err) {
    console.error("[purchase] ensureEnrollment failed:", err);
  }

  // Receipt + access + what-next, to EVERY buyer. This used to be a
  // set-password email that only reached first-time guests, so a returning
  // customer paid and heard nothing at all.
  try {
    await sendCoursePurchaseEmail(purchase.id);
  } catch (err) {
    console.error("[purchase] purchase email failed:", err);
  }

  // Credit the private income tracker. Idempotent via (source, reference).
  if (purchase.amount > 0) {
    try {
      await prisma.incomeEntry.upsert({
        where: {
          source_reference: { source: "FIREBUDDY", reference: purchase.id },
        },
        update: {
          amount: purchase.amount,
          currency: purchase.currency,
          description: `${purchase.course.title} — course purchase`,
        },
        create: {
          amount: purchase.amount,
          // Without this a euro sale is filed as pounds and overstates income.
          currency: purchase.currency,
          source: "FIREBUDDY",
          reference: purchase.id,
          description: `${purchase.course.title} — course purchase`,
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[purchase] Failed to credit income tracker:", err);
    }
  }
}
