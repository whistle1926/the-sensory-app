import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await prisma.enrollment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true, modules: { select: { id: true } } } },
      moduleProgress: { select: { status: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const result = enrollments.map((e) => {
    const totalModules = e.course.modules.length;
    const completedModules = e.moduleProgress.filter((mp) => mp.status === "COMPLETED").length;

    return {
      id: e.id,
      user: e.user,
      course: { id: e.course.id, title: e.course.title },
      status: e.status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      totalModules,
      completedModules,
      progressPercent: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}
