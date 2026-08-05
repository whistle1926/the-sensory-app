/**
 * Publish the draft — copy unpublished edits onto the live columns.
 *
 * This is the moment a change becomes visible to parents. Everything is
 * written in one update so the page can never be seen half-updated, and the
 * draft is emptied so the editor stops showing "unpublished changes".
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanDraft, changedFields } from "@/lib/course-draft";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { courseId } = await params;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draft = cleanDraft(course.draft);
  const pending = changedFields(course as unknown as Record<string, unknown>, draft);
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, published: 0, message: "Nothing to publish." });
  }

  // Only write the fields that actually changed, then clear the draft — all in
  // one statement so the public page never sees a partial update.
  const data: Record<string, unknown> = {};
  for (const k of pending) data[k] = draft[k];

  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...data,
      draft: {} as unknown as Prisma.InputJsonValue,
      draftUpdatedAt: null,
      publishedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, published: pending.length });
}
