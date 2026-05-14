/**
 * Module create endpoint. Staff only.
 *
 * Body (all optional): { title }. Order is auto-assigned to the next
 * available slot at the end of the course. Content + questions seed as
 * empty arrays — the lesson editor (future) will fill them.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const last = await prisma.module.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.module.create({
    data: {
      courseId,
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim().slice(0, 240)
          : "New module",
      order: (last?.order ?? -1) + 1,
      content: [],
      questions: [],
    },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
