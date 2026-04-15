import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VALID_PRIORITIES } from "@/lib/tasks";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      assignees: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      clientUser: { select: { id: true, name: true, email: true } },
      subtasks: { orderBy: { order: "asc" } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const priority = typeof body.priority === "string" && VALID_PRIORITIES.has(body.priority)
    ? body.priority
    : "medium";

  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
  }

  const assigneeIds: string[] = Array.isArray(body.assigneeIds)
    ? body.assigneeIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const clientUserId = typeof body.clientUserId === "string" && body.clientUserId.length > 0
    ? body.clientUserId
    : null;
  const subtasks: { title: string }[] = Array.isArray(body.subtasks)
    ? body.subtasks
        .filter((s: unknown): s is { title: string } =>
          !!s && typeof (s as { title?: unknown }).title === "string"
        )
        .map((s: { title: string }) => ({ title: s.title.trim() }))
        .filter((s: { title: string }) => s.title.length > 0)
    : [];

  // Validate that assignees are real non-CLIENT users and the client is a CLIENT.
  if (assigneeIds.length > 0) {
    const count = await prisma.user.count({
      where: { id: { in: assigneeIds }, role: { in: ["SUPER_ADMIN", "TEAM_MANAGER"] } },
    });
    if (count !== assigneeIds.length) {
      return NextResponse.json({ error: "Unknown assignee" }, { status: 400 });
    }
  }
  if (clientUserId) {
    const client = await prisma.user.findUnique({
      where: { id: clientUserId },
      select: { role: true },
    });
    if (!client || client.role !== "CLIENT") {
      return NextResponse.json({ error: "Unknown client" }, { status: 400 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      priority,
      status: "todo",
      dueDate,
      createdById: session.user.id,
      clientUserId,
      assignees: {
        create: assigneeIds.map((userId) => ({ userId })),
      },
      subtasks: {
        create: subtasks.map((s, i) => ({ title: s.title, order: i })),
      },
    },
    include: {
      assignees: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      clientUser: { select: { id: true, name: true, email: true } },
      subtasks: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
