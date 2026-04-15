import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const last = await prisma.subtask.findFirst({
    where: { taskId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const subtask = await prisma.subtask.create({
    data: { taskId, title, order },
  });
  return NextResponse.json(subtask, { status: 201 });
}
