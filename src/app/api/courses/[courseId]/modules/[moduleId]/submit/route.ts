import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitQuizSchema } from "@/lib/validators";
import type { QuizQuestion } from "@/types/course";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { courseId, moduleId } = await params;

  const body = await req.json();
  const parsed = submitQuizSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const mod = await prisma.module.findFirst({ where: { id: moduleId, courseId } });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { moduleProgress: true },
  });

  if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  const progress = enrollment.moduleProgress.find((mp) => mp.moduleId === moduleId);
  if (!progress || progress.status === "LOCKED") {
    return NextResponse.json({ error: "Module is locked" }, { status: 403 });
  }
  if (progress.status === "COMPLETED") {
    return NextResponse.json({ error: "Module already completed" }, { status: 400 });
  }

  const questions = mod.questions as unknown as QuizQuestion[];
  if (parsed.data.answers.length !== questions.length) {
    return NextResponse.json({ error: `Expected ${questions.length} answers` }, { status: 400 });
  }

  let correct = 0;
  const feedback = questions.map((q, i) => {
    const isCorrect = parsed.data.answers[i] === q.correctIndex;
    if (isCorrect) correct++;
    return { questionId: q.id, isCorrect, correctIndex: q.correctIndex, selected: parsed.data.answers[i] };
  });

  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= 80;

  const updatedProgress = await prisma.moduleProgress.update({
    where: { id: progress.id },
    data: {
      score,
      attempts: { increment: 1 },
      status: passed ? "COMPLETED" : "FAILED",
      completedAt: passed ? new Date() : null,
    },
  });

  if (passed) {
    const allModules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    const currentIndex = allModules.findIndex((m) => m.id === moduleId);
    const nextModule = allModules[currentIndex + 1];

    if (nextModule) {
      const nextProgress = enrollment.moduleProgress.find((mp) => mp.moduleId === nextModule.id);
      if (nextProgress && nextProgress.status === "LOCKED") {
        await prisma.moduleProgress.update({
          where: { id: nextProgress.id },
          data: { status: "IN_PROGRESS" },
        });
      }
    }

    const allProgress = await prisma.moduleProgress.findMany({
      where: { enrollmentId: enrollment.id },
    });
    const allCompleted = allProgress.every((mp) => mp.status === "COMPLETED");

    if (allCompleted) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
  }

  return NextResponse.json({
    score,
    passed,
    feedback,
    status: updatedProgress.status,
    attempts: updatedProgress.attempts,
  });
}
