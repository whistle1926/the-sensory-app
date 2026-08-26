import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCoursePayment } from "@/lib/course-payment-check";

/**
 * Public poll endpoint used by /courses/thanks while the buyer waits.
 *
 * It no longer waits for Fire's webhook, which has never once completed a
 * purchase here: our "course:<id>" reference comes back from Fire as
 * "coursecmt9ruhil000" — colon stripped, truncated — so the webhook's
 * routing could never match it, and buyers sat on "still processing" for
 * ever. While we believe a purchase is pending we ask Fire outright, and
 * complete it if the money is really there. Returns only non-sensitive status fields, keyed on the
 * purchase id (which is already in the buyer's URL).
 *
 * Not guarded — knowing the status of purchase X doesn't leak anything
 * beyond "it was paid" or "still pending", and the purchase id is a
 * 25-char cuid (unguessable).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> },
) {
  const { purchaseId } = await params;
  const purchase = await prisma.coursePurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      completedAt: true,
    },
  });
  if (!purchase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Still pending as far as we know — ask Fire, who actually knows.
  if (purchase.paymentStatus !== "paid") {
    const check = await checkCoursePayment(purchaseId);
    if (check.paid) {
      const fresh = await prisma.coursePurchase.findUnique({
        where: { id: purchaseId },
        select: { id: true, courseId: true, paymentStatus: true, completedAt: true },
      });
      return NextResponse.json(fresh ?? purchase);
    }
  }

  return NextResponse.json(purchase);
}
