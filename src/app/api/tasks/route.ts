import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VALID_PRIORITIES } from "@/lib/tasks";
import { sanitizeRichText } from "@/lib/rich-text";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull the latest comment alongside the task so we can compute a real
  // "last activity" timestamp = max(task.updatedAt, latest-comment.createdAt)
  // and sort by it. That way new comments bubble tasks to the top too,
  // not just direct edits.
  const tasks = await prisma.task.findMany({
    include: {
      // "Requested By" column on the new CRM-style table view.
      createdBy: { select: { id: true, name: true, email: true } },
      assignees: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      clientUser: { select: { id: true, name: true, email: true } },
      subtasks: { orderBy: { order: "asc" } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, author: { select: { name: true } } },
      },
      // Quick-tap "Build Updates" feedback chips. Newest first so the
      // page can render an unread count without re-sorting.
      feedback: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          message: true,
          createdAt: true,
          resolvedAt: true,
        },
      },
      _count: { select: { comments: true } },
    },
  });

  const withActivity = tasks.map((t) => {
    const lastComment = t.comments[0]?.createdAt ?? null;
    // Newest feedback chip — bubbles cards up the moment Patrick leaves
    // a Works/Issue/Suggestion/Confused note. `feedback` is already
    // ordered desc above, so feedback[0] is the latest.
    const lastFeedback = t.feedback[0]?.createdAt ?? null;
    // Pick the most recent of the three signals (task edit, comment,
    // feedback) as the cards' "last activity" stamp.
    const candidates: { at: Date; source: "edited" | "comment" | "feedback" }[] = [
      { at: t.updatedAt, source: "edited" },
    ];
    if (lastComment) candidates.push({ at: lastComment, source: "comment" });
    if (lastFeedback) candidates.push({ at: lastFeedback, source: "feedback" });
    candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    const lastActivityAt = candidates[0].at;
    const source: "created" | "edited" | "comment" | "feedback" =
      t.updatedAt.getTime() === t.createdAt.getTime() &&
      candidates[0].source === "edited"
        ? "created"
        : candidates[0].source;
    // Strip the latest-comment relation from the payload so the client
    // sees a clean shape — lastActivitySource / Author carry the meta.
    const { comments: _c, ...rest } = t;
    void _c;
    return {
      ...rest,
      lastActivityAt,
      lastActivitySource: source,
      lastActivityAuthor:
        source === "comment" ? (t.comments[0]?.author?.name ?? null) : null,
    };
  });
  withActivity.sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
  );

  return NextResponse.json(withActivity);
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
      description:
        typeof body.description === "string"
          ? sanitizeRichText(body.description) || null
          : null,
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
