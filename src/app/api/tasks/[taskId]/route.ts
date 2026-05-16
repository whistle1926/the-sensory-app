import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VALID_PRIORITIES, VALID_STATUSES } from "@/lib/tasks";
import { sanitizeRichText } from "@/lib/rich-text";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { taskId } = await params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignees: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      clientUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      subtasks: { orderBy: { order: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true } },
          attachments: true,
        },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { taskId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.description === "string") {
    data.description = sanitizeRichText(body.description) || null;
  }
  if (typeof body.priority === "string") {
    if (!VALID_PRIORITIES.has(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    data.priority = body.priority;
  }
  if (typeof body.status === "string") {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.completedAt = body.status === "done" ? new Date() : null;

    // CRM-style lifecycle stamps for the /tasks table view:
    //   • First flip to "in_progress" (Sent to Paddy) → lock firstBuildAt
    //     and stamp latestBuildAt.
    //   • Every subsequent flip back to "in_progress" → bump latestBuildAt
    //     only ("user re-pinged to iterate").
    // Other status transitions leave both untouched so the audit trail
    // shows the original request lifecycle even after completion.
    if (body.status === "in_progress") {
      const existing = await prisma.task.findUnique({
        where: { id: taskId },
        select: { firstBuildAt: true },
      });
      if (!existing?.firstBuildAt) data.firstBuildAt = new Date();
      data.latestBuildAt = new Date();
    }
  }
  if ("dueDate" in body) {
    if (body.dueDate === null) {
      data.dueDate = null;
    } else {
      const d = new Date(body.dueDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
      }
      data.dueDate = d;
    }
  }
  if ("clientUserId" in body) {
    if (body.clientUserId === null) {
      data.clientUserId = null;
    } else if (typeof body.clientUserId === "string") {
      const c = await prisma.user.findUnique({
        where: { id: body.clientUserId },
        select: { role: true },
      });
      if (!c || c.role !== "CLIENT") {
        return NextResponse.json({ error: "Unknown client" }, { status: 400 });
      }
      data.clientUserId = body.clientUserId;
    }
  }

  // Assignee list replacement (optional).
  if (Array.isArray(body.assigneeIds)) {
    const ids: string[] = body.assigneeIds.filter(
      (id: unknown): id is string => typeof id === "string"
    );
    if (ids.length > 0) {
      const count = await prisma.user.count({
        where: { id: { in: ids }, role: { in: ["SUPER_ADMIN", "TEAM_MANAGER"] } },
      });
      if (count !== ids.length) {
        return NextResponse.json({ error: "Unknown assignee" }, { status: 400 });
      }
    }
    await prisma.$transaction([
      prisma.taskAssignee.deleteMany({ where: { taskId } }),
      ...ids.map((userId) =>
        prisma.taskAssignee.create({ data: { taskId, userId } })
      ),
    ]);
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      assignees: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      clientUser: { select: { id: true, name: true, email: true } },
      subtasks: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { taskId } = await params;
  await prisma.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
