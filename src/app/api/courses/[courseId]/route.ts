import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, order: true },
      },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: {
            select: { moduleId: true, status: true, score: true, attempts: true, completedAt: true },
          },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = course.enrollments[0] ?? null;
  const progressMap = new Map(
    enrollment?.moduleProgress.map((mp) => [mp.moduleId, mp]) ?? []
  );

  const modules = course.modules.map((mod) => {
    const progress = progressMap.get(mod.id);
    return {
      ...mod,
      status: progress?.status ?? "LOCKED",
      score: progress?.score ?? null,
      attempts: progress?.attempts ?? 0,
      completedAt: progress?.completedAt ?? null,
    };
  });

  return NextResponse.json({
    id: course.id,
    title: course.title,
    slug: course.slug,
    audience: course.audience,
    duration: course.duration,
    description: course.description,
    status: course.status,
    modules,
    enrollmentId: enrollment?.id ?? null,
    enrollmentStatus: enrollment?.status ?? null,
    completedAt: enrollment?.completedAt ?? null,
  });
}
