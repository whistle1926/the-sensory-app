import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/** PATCH — toggle resolved state on a feedback row. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string; feedbackId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { feedbackId } = await params;
  const body = (await req.json().catch(() => ({}))) as { resolved?: boolean };
  const updated = await prisma.taskFeedback.update({
    where: { id: feedbackId },
    data: {
      resolvedAt: body.resolved ? new Date() : null,
    },
  });
  return NextResponse.json(updated);
}

/** DELETE — remove a feedback row outright. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string; feedbackId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { feedbackId } = await params;
  await prisma.taskFeedback.delete({ where: { id: feedbackId } });
  return NextResponse.json({ ok: true });
}
