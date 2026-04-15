import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Comments are readable/writable by:
 * - Admins (SUPER_ADMIN, TEAM_MANAGER)
 * - The CLIENT user the task is shared with (task.clientUserId === session.user.id)
 * This endpoint is used from both the admin task detail page and the
 * portal feedback page.
 */
async function loadTaskForUser(taskId: string, userId: string, role: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, clientUserId: true },
  });
  if (!task) return null;
  if (role === "CLIENT" && task.clientUserId !== userId) return null;
  return task;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { taskId } = await params;
  const task = await loadTaskForUser(taskId, session.user.id, session.user.role);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  if (text.length > 5000) {
    return NextResponse.json({ error: "Comment is too long" }, { status: 400 });
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      authorId: session.user.id,
      body: text,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json(comment, { status: 201 });
}
