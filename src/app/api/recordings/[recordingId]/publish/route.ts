/**
 * Publish a synced recording onto the client content platform.
 *
 * POST body (one of):
 *   { target: "module", moduleId }                 — attach to an existing lesson
 *   { target: "module", courseId, newTitle? }      — create a new lesson in a course
 *   { target: "liveRoom", liveRoomId }             — set as a live-session replay
 *
 * Sets the Vimeo link on the target (Module.videoUrl / LiveRoom.mediaUrl).
 * The course player already renders vimeo.com links as an embedded player,
 * so the video is watchable by clients immediately.
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { recordingId } = await params;
  const rec = await prisma.recordingSync.findUnique({ where: { id: recordingId } });
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rec.vimeoLink) {
    return NextResponse.json(
      { error: "This recording has no Vimeo link yet." },
      { status: 400 },
    );
  }
  if (rec.status !== "ready") {
    return NextResponse.json(
      { error: "Vimeo is still processing this video — try again once it's Ready." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    target?: "module" | "liveRoom";
    moduleId?: string;
    courseId?: string;
    newTitle?: string;
    liveRoomId?: string;
  };

  // ── Live session replay ────────────────────────────────────────────
  if (body.target === "liveRoom") {
    if (!body.liveRoomId) {
      return NextResponse.json({ error: "liveRoomId is required" }, { status: 400 });
    }
    const room = await prisma.liveRoom.findUnique({ where: { id: body.liveRoomId } });
    if (!room) return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    await prisma.liveRoom.update({
      where: { id: room.id },
      data: { mediaUrl: rec.vimeoLink },
    });
    await prisma.recordingSync.update({
      where: { id: rec.id },
      data: { publishedLiveRoomId: room.id, publishedModuleId: null, publishedAt: new Date() },
    });
    return NextResponse.json({ ok: true, target: "liveRoom", id: room.id });
  }

  // ── Course lesson (module) ─────────────────────────────────────────
  if (body.target === "module") {
    let moduleId = body.moduleId;

    // Create a new lesson at the end of the chosen course if none picked.
    if (!moduleId) {
      if (!body.courseId) {
        return NextResponse.json(
          { error: "Pick a course (or an existing lesson)." },
          { status: 400 },
        );
      }
      const course = await prisma.course.findUnique({ where: { id: body.courseId } });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
      const last = await prisma.module.findFirst({
        where: { courseId: course.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const created = await prisma.module.create({
        data: {
          courseId: course.id,
          title: (body.newTitle?.trim() || rec.topic).slice(0, 240),
          order: (last?.order ?? -1) + 1,
          content: [],
          questions: [],
          videoUrl: rec.vimeoLink,
        },
      });
      moduleId = created.id;
    } else {
      const mod = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      await prisma.module.update({
        where: { id: moduleId },
        data: { videoUrl: rec.vimeoLink },
      });
    }

    await prisma.recordingSync.update({
      where: { id: rec.id },
      data: { publishedModuleId: moduleId, publishedLiveRoomId: null, publishedAt: new Date() },
    });
    return NextResponse.json({ ok: true, target: "module", id: moduleId });
  }

  return NextResponse.json({ error: "Unknown target" }, { status: 400 });
}
