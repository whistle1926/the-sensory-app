import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { QuizQuestion } from "@/types/course";

/**
 * Mark a module complete without a quiz.
 *
 * Used for content-only lessons (video / reading / no questions). If the
 * module has questions, refuse — force them through the quiz so the
 * completion is meaningful.
 *
 * Unlocks the next module and closes the enrolment if everything's done.
 * Mirrors the post-passed-quiz logic in /submit to keep behaviour
 * consistent.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { courseId, moduleId } = await params;

  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId },
  });
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const questions = (mod.questions as unknown as QuizQuestion[]) ?? [];
  if (questions.length > 0) {
    return NextResponse.json(
      {
        error:
          "This module has a quiz — complete it via the quiz submit flow.",
      },
      { status: 400 },
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { moduleProgress: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
  }

  const progress = enrollment.moduleProgress.find(
    (mp) => mp.moduleId === moduleId,
  );
  if (!progress || progress.status === "LOCKED") {
    return NextResponse.json({ error: "Module is locked" }, { status: 403 });
  }
  if (progress.status === "COMPLETED") {
    return NextResponse.json({
      status: "COMPLETED",
      alreadyComplete: true,
    });
  }

  await prisma.moduleProgress.update({
    where: { id: progress.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      // No score for content-only modules — leave as null / default.
    },
  });

  // Unlock next module in order
  const allModules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const currentIndex = allModules.findIndex((m) => m.id === moduleId);
  const nextModule = allModules[currentIndex + 1];
  if (nextModule) {
    const nextProgress = enrollment.moduleProgress.find(
      (mp) => mp.moduleId === nextModule.id,
    );
    if (nextProgress && nextProgress.status === "LOCKED") {
      await prisma.moduleProgress.update({
        where: { id: nextProgress.id },
        data: { status: "IN_PROGRESS" },
      });
    }
  }

  // Mark enrolment complete when every module is done
  const allProgress = await prisma.moduleProgress.findMany({
    where: { enrollmentId: enrollment.id },
  });
  const allCompleted = allProgress.every(
    (mp) => mp.status === "COMPLETED" || mp.moduleId === moduleId,
  );
  if (allCompleted) {
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  return NextResponse.json({ status: "COMPLETED" });
}
