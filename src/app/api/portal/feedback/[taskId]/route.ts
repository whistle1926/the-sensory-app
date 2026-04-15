import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { taskId } = await params;
  const task = await prisma.task.findFirst({
    where: { id: taskId, clientUserId: session.user.id },
    include: {
      createdBy: { select: { id: true, name: true } },
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
