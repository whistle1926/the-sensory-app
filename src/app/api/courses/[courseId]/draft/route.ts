/**
 * Autosave and discard unpublished course edits.
 *
 * PUT stores the editor's current state in Course.draft. It never touches the
 * published columns, so a course that is on sale keeps showing its old copy
 * until someone presses Publish.
 *
 * DELETE throws the draft away and goes back to what's live.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanDraft, changedFields } from "@/lib/course-draft";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { courseId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const draft = cleanDraft(body.draft ?? body);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      draft: draft as unknown as Prisma.InputJsonValue,
      draftUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({
    savedAt: updated.draftUpdatedAt,
    pending: changedFields(updated as unknown as Record<string, unknown>, updated.draft),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { courseId } = await params;
  await prisma.course.update({
    where: { id: courseId },
    data: { draft: {} as unknown as Prisma.InputJsonValue, draftUpdatedAt: null },
  });
  return NextResponse.json({ ok: true });
}
