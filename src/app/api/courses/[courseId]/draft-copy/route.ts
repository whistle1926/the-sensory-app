/**
 * Draft the storefront copy for a course from the therapist's rough notes.
 *
 * Grace writes a few lines about the webinar; this returns a full set of
 * suggested fields (tagline, card blurb, description, who it's for, what's
 * covered). Nothing is saved — the editor drops the suggestions into the form
 * so she can change anything before hitting Save. That's deliberate: it's copy
 * for a paid product, so a human approves it.
 *
 * The notes are stored on the course so a draft can be regenerated later
 * without re-typing them.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftCourseCopy } from "@/lib/claude";

export const maxDuration = 120;

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { notes?: unknown };
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length < 15) {
    return NextResponse.json(
      { error: "Write a couple of lines about the course first — the more you give, the better the draft." },
      { status: 400 },
    );
  }

  // Keep the notes so she can tweak them and re-draft without retyping.
  await prisma.course.update({
    where: { id: courseId },
    data: { copyNotes: notes.slice(0, 5_000) },
  });

  try {
    const draft = await draftCourseCopy({ title: course.title, notes });
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[course-copy] draft failed", err);
    return NextResponse.json(
      { error: "Couldn't write the draft just now. Try again in a moment." },
      { status: 502 },
    );
  }
}
