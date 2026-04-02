import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { orderBy: { order: "asc" }, select: { id: true } } },
  });

  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (course.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Course is not available for enrollment" }, { status: 400 });
  }
  if (course.modules.length === 0) {
    return NextResponse.json({ error: "Course has no modules" }, { status: 400 });
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });

  if (existing) {
    return NextResponse.json({ error: "Already enrolled", enrollmentId: existing.id }, { status: 409 });
  }

  const enrollment = await prisma.enrollment.create({
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
    include: { moduleProgress: true },
  });

  return NextResponse.json(enrollment, { status: 201 });
}
