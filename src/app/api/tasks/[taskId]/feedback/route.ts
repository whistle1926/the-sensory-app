import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_KINDS = ["works", "issue", "suggestion", "confused"] as const;
type Kind = (typeof VALID_KINDS)[number];

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/** POST — leave a feedback chip on a task. Body: { kind, message? }. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    message?: string;
  };
  if (!VALID_KINDS.includes(body.kind as Kind)) {
    return NextResponse.json(
      { error: "Invalid kind" },
      { status: 400 },
    );
  }
  // Confirm the task exists so we don't leave dangling feedback rows.
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const created = await prisma.taskFeedback.create({
    data: {
      taskId,
      kind: body.kind as Kind,
      message:
        typeof body.message === "string"
          ? body.message.slice(0, 5_000)
          : "",
    },
  });
  return NextResponse.json(created, { status: 201 });
}
