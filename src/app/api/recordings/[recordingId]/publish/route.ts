/**
 * Publish a synced recording onto the client content platform.
 *
 * POST body (one of):
 *   { target: "module", moduleId }                 — attach to an existing lesson
 *   { target: "module", courseId, newTitle? }      — create a new lesson in a course
 *   { target: "module", newCourseTitle, newTitle? }— create a NEW course + lesson
 *   { target: "liveRoom", liveRoomId }             — set as a live-session replay
 *
 * Sets the Vimeo link on the target (Module.videoUrl / LiveRoom.mediaUrl).
 * The course player already renders vimeo.com links as an embedded player,
 * so the video is watchable by clients immediately.
 *
 * Returns a `previewUrl` — the page a learner would actually see — so the
 * admin can check their work rather than guessing.
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { setThumbnail } from "@/lib/vimeo";

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
    newCourseTitle?: string;
    liveRoomId?: string;
    /** Optional custom poster image (already uploaded to Blob). */
    thumbnailUrl?: string;
  };

  // Apply a custom thumbnail to the Vimeo video if one was chosen at publish
  // time. Best-effort: a thumbnail problem must not block publishing the
  // lesson, so we surface it as a warning alongside a successful publish.
  let thumbnailWarning: string | null = null;
  if (body.thumbnailUrl && rec.vimeoUri) {
    thumbnailWarning = await setThumbnail(rec.vimeoUri, body.thumbnailUrl);
    // Remember it so the Recordings list can show the current poster and
    // offer to change it later.
    if (!thumbnailWarning) {
      await prisma.recordingSync.update({
        where: { id: rec.id },
        data: { thumbnailUrl: body.thumbnailUrl },
      });
    }
  }

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
    return NextResponse.json({
      ok: true,
      target: "liveRoom",
      id: room.id,
      previewUrl: `/live/${room.id}`,
      thumbnailWarning,
    });
  }

  // ── Course lesson (module) ─────────────────────────────────────────
  if (body.target === "module") {
    let moduleId = body.moduleId;
    let courseId = body.courseId;

    // Optionally spin up a brand-new course first (used for the "test
    // course" flow). Created ARCHIVED, so it's hidden from the public
    // storefront until it's deliberately published — safe to experiment in.
    if (!moduleId && body.newCourseTitle?.trim()) {
      const title = body.newCourseTitle.trim().slice(0, 200);
      let slug = slugify(title);
      for (let i = 0; i < 5; i++) {
        const exists = await prisma.course.findUnique({ where: { slug } });
        if (!exists) break;
        slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const last = await prisma.course.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      // Carry the publisher's own details onto the course, so the person who
      // recorded it is credited without retyping their bio and photo every
      // time. Grace was filling these in by hand for each course. Anything
      // blank on their profile simply isn't set here — the source has to be
      // filled in once, under Team → their profile.
      const publisher = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, bio: true, photoUrl: true },
      });

      const newCourse = await prisma.course.create({
        data: {
          title,
          slug,
          audience: "",
          duration: "",
          description: "",
          status: "ARCHIVED", // hidden from the storefront until published
          price: 0,
          order: (last?.order ?? -1) + 1,
          instructorName: publisher?.name || null,
          instructorBio: publisher?.bio || null,
          instructorImageUrl: publisher?.photoUrl || null,
        },
      });
      courseId = newCourse.id;
    }

    // Create a new lesson at the end of the chosen course if none picked.
    if (!moduleId) {
      if (!courseId) {
        return NextResponse.json(
          { error: "Pick a course (or an existing lesson)." },
          { status: 400 },
        );
      }
      const course = await prisma.course.findUnique({ where: { id: courseId } });
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
      courseId = mod.courseId;
      await prisma.module.update({
        where: { id: moduleId },
        data: { videoUrl: rec.vimeoLink },
      });
    }

    await prisma.recordingSync.update({
      where: { id: rec.id },
      data: { publishedModuleId: moduleId, publishedLiveRoomId: null, publishedAt: new Date() },
    });
    return NextResponse.json({
      ok: true,
      target: "module",
      id: moduleId,
      courseId,
      // The exact page a learner sees for this lesson.
      previewUrl: `/portal/training/${courseId}/${moduleId}`,
      thumbnailWarning,
    });
  }

  return NextResponse.json({ error: "Unknown target" }, { status: 400 });
}
