import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { QuizQuestion } from "@/types/course";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { courseId, moduleId } = await params;

  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId },
  });

  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: {
      moduleProgress: { where: { moduleId } },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
  }

  const progress = enrollment.moduleProgress[0];
  if (!progress || progress.status === "LOCKED") {
    return NextResponse.json({ error: "Module is locked" }, { status: 403 });
  }

  const questions = mod.questions as unknown as QuizQuestion[];
  const strippedQuestions = progress.status === "COMPLETED"
    ? questions
    : questions.map(({ correctIndex: _ci, ...q }) => q);

  return NextResponse.json({
    id: mod.id,
    title: mod.title,
    order: mod.order,
    content: mod.content,
    questions: strippedQuestions,
    videoUrl: mod.videoUrl ?? null,
    coverImageUrl: mod.coverImageUrl ?? null,
    status: progress.status,
    score: progress.score,
    attempts: progress.attempts,
  });
}
