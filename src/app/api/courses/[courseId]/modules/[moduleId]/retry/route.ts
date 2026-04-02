import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { courseId, moduleId } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { moduleProgress: { where: { moduleId } } },
  });

  if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  const progress = enrollment.moduleProgress[0];
  if (!progress) return NextResponse.json({ error: "Module not found" }, { status: 404 });
  if (progress.status !== "FAILED") {
    return NextResponse.json({ error: "Module is not in failed state" }, { status: 400 });
  }

  const updated = await prisma.moduleProgress.update({
    where: { id: progress.id },
    data: { status: "IN_PROGRESS", score: null, completedAt: null },
  });

  return NextResponse.json(updated);
}
