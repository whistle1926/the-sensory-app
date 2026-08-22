/**
 * POST — apply a triage decision made from the notification email.
 *
 * Deliberately not authenticated by session: the whole point is answering
 * from a phone without signing in. The signed token IS the authorisation,
 * and it only unlocks two reversible states on one ticket.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTriageToken } from "@/lib/task-triage";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const token = typeof body.token === "string" ? body.token : "";
  const action = body.action === "park" ? "park" : body.action === "action" ? "action" : "";

  if (!taskId || !userId || !token || !action) {
    return NextResponse.json({ error: "Missing details" }, { status: 400 });
  }
  if (!verifyTriageToken(taskId, userId, token)) {
    return NextResponse.json({ error: "That link isn't valid." }, { status: 403 });
  }

  const [task, user] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId }, select: { id: true, title: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } }),
  ]);
  if (!task || !user || user.role === "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  await prisma.task.update({
    where: { id: taskId },
    data:
      action === "action"
        ? { agentQueuedAt: now, parkedAt: null, triagedById: userId, status: "in_progress" }
        : { parkedAt: now, agentQueuedAt: null, triagedById: userId },
  });

  // Leave a trace on the board, so the rest of the team can see a decision
  // was made rather than the ticket silently changing.
  await prisma.taskComment
    .create({
      data: {
        taskId,
        authorId: userId,
        body:
          action === "action"
            ? "Actioned from my email — picking this up."
            : "Parked for now — I'll come back to this.",
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, action, title: task.title });
}
