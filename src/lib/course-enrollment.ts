import { prisma } from "@/lib/prisma";

/**
 * Ensure the given user is enrolled in the course, seeding ModuleProgress
 * rows (first module IN_PROGRESS, the rest LOCKED). Idempotent — returns the
 * existing enrolment if one is already present.
 */
export async function ensureEnrollment(userId: string, courseId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  if (modules.length === 0) {
    throw new Error("Course has no modules");
  }

  return prisma.enrollment.create({
    data: {
      userId,
      courseId,
      moduleProgress: {
        create: modules.map((mod, index) => ({
          moduleId: mod.id,
          status: index === 0 ? "IN_PROGRESS" : "LOCKED",
        })),
      },
    },
  });
}
