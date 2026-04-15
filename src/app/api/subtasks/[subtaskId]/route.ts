import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subtaskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { subtaskId } = await params;
  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.done === "boolean") data.done = body.done;
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  const subtask = await prisma.subtask.update({ where: { id: subtaskId }, data });
  return NextResponse.json(subtask);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ subtaskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { subtaskId } = await params;
  await prisma.subtask.delete({ where: { id: subtaskId } });
  return NextResponse.json({ ok: true });
}
