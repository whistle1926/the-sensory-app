import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { ensureEnrollment } from "@/lib/course-enrollment";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { courseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const courseId = typeof body.courseId === "string" ? body.courseId : "";
  if (!courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { orderBy: { order: "asc" }, select: { id: true } } },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (course.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Course is not available" }, { status: 400 });
  }
  if (course.modules.length === 0) {
    return NextResponse.json({ error: "Course has no modules" }, { status: 400 });
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (existing) {
    return NextResponse.json({
      redirect: `/portal/training/${courseId}`,
      enrollmentId: existing.id,
    });
  }

  // Free course → enrol immediately
  if (course.price === 0) {
    await ensureEnrollment(session.user.id, courseId);
    return NextResponse.json({ redirect: `/portal/training/${courseId}` });
  }

  // Paid course → FireBuddy hosted checkout
  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });
  if (!paymentSettings?.enabled || !paymentSettings.apiKey) {
    return NextResponse.json(
      { error: "Payments are not configured yet. Please contact support." },
      { status: 503 }
    );
  }

  const purchase = await prisma.coursePurchase.create({
    data: {
      userId: session.user.id,
      courseId,
      amount: course.price,
      paymentStatus: "pending",
    },
  });

  try {
    const fb = new FireBuddy(paymentSettings.apiKey);
    const origin = req.nextUrl.origin;
    const payment = await fb.createPayment({
      amount: course.price, // Course.price is already pounds
      currency: "GBP",
      description: `${course.title} — CPD course`,
      reference: `course:${purchase.id}`,
      email: session.user.email ?? undefined,
      returnUrl: `${origin}/portal/training/${courseId}/purchased?purchase=${purchase.id}`,
    });

    await prisma.coursePurchase.update({
      where: { id: purchase.id },
      data: { paymentRef: payment.code },
    });

    return NextResponse.json({ paymentUrl: payment.paymentUrl, purchaseId: purchase.id });
  } catch (err) {
    console.error("FireBuddy course payment failed:", err);
    await prisma.coursePurchase.update({
      where: { id: purchase.id },
      data: { paymentStatus: "failed" },
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }
}
