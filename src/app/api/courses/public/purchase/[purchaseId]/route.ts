import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Minimal public poll endpoint used by /courses/thanks to wait for the
 * FireBuddy webhook. Returns only non-sensitive status fields, keyed on the
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
  return NextResponse.json(purchase);
}
