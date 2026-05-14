import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    include: {
      modules: { select: { id: true }, orderBy: { order: "asc" } },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: { select: { status: true } },
        },
      },
    },
  });

  const result = courses.map((course) => {
    const enrollment = course.enrollments[0] ?? null;
    const totalModules = course.modules.length;
    const completedModules = enrollment
      ? enrollment.moduleProgress.filter((mp) => mp.status === "COMPLETED").length
      : 0;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      audience: course.audience,
      duration: course.duration,
      description: course.description,
      status: course.status,
      order: course.order,
      price: course.price,
      isFeatured: course.isFeatured,
      isBestseller: course.isBestseller,
      totalModules,
      enrollmentStatus: enrollment?.status ?? null,
      enrollmentId: enrollment?.id ?? null,
      completedModules,
      progressPercent: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}
