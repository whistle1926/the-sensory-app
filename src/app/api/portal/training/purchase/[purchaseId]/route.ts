import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { purchaseId } = await params;
  const purchase = await prisma.coursePurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      userId: true,
      courseId: true,
      paymentStatus: true,
      completedAt: true,
    },
  });

  if (!purchase || purchase.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: purchase.id,
    courseId: purchase.courseId,
    paymentStatus: purchase.paymentStatus,
    completedAt: purchase.completedAt,
  });
}
