import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { goalId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const role = session.user.role;
  const data: Record<string, unknown> = {};

  // Admins can update everything; clients can only update parentNote.
  if (role !== "CLIENT") {
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (typeof body.achieved === "boolean") {
      data.achieved = body.achieved;
      data.reviewedAt = body.achieved ? new Date() : null;
    }
    if (typeof body.reviewNote === "string") data.reviewNote = body.reviewNote.trim() || null;
  }
  // Both admin and client can set parentNote.
  if (typeof body.parentNote === "string") {
    data.parentNote = body.parentNote.trim() || null;
  }

  const goal = await prisma.clientGoal.update({ where: { id: goalId }, data });
  return NextResponse.json(goal);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { goalId } = await params;
  await prisma.clientGoal.delete({ where: { id: goalId } });
  return NextResponse.json({ ok: true });
}
