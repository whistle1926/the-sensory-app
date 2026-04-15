import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
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
    await prisma.enrollment.create({
      data: {
        userId: session.user.id,
        courseId,
        moduleProgress: {
          create: course.modules.map((mod, index) => ({
            moduleId: mod.id,
            status: index === 0 ? "IN_PROGRESS" : "LOCKED",
          })),
        },
      },
    });
    return NextResponse.json({ redirect: `/portal/training/${courseId}` });
  }

  // Paid path wired up in Phase 3 (FireBuddy checkout).
  return NextResponse.json(
    { error: "Paid courses are not yet available. Please check back soon." },
    { status: 501 }
  );
}
