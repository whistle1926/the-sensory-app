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

/** Staff-only — update editable module fields. Currently exposes only
 * `videoUrl` (for Loom/YouTube/Vimeo embeds) and `title`; lesson content
 * and quiz questions stay seed-script-managed for now. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> },
) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId, moduleId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string")
    data.title = body.title.trim().slice(0, 240) || null;
  if (body.videoUrl === null) data.videoUrl = null;
  else if (typeof body.videoUrl === "string") {
    const v = body.videoUrl.trim();
    data.videoUrl = v ? v.slice(0, 1_000) : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Confirm the module belongs to the URL's course (defence in depth).
  const existing = await prisma.module.findFirst({
    where: { id: moduleId, courseId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.module.update({
    where: { id: moduleId },
    data,
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

/** Delete a module. Staff only. ModuleProgress rows cascade. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> },
) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { courseId, moduleId } = await params;
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId },
    select: { id: true },
  });
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.module.delete({ where: { id: moduleId } });
  return NextResponse.json({ ok: true });
}
