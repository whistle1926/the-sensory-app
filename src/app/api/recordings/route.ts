/**
 * Synced Zoom→Vimeo recordings, for the admin Recordings page.
 *
 * GET — refreshes any in-flight Vimeo transcodes, then returns the recordings
 *       plus the publish targets (courses/modules and live sessions) so the
 *       page can render its "Publish to…" picker in one round-trip.
 *
 * Staff-only.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshRecordingStatuses } from "@/lib/recording-sync";
import { zoomConfigured } from "@/lib/zoom";
import { vimeoConfigured } from "@/lib/vimeo";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Advance anything Vimeo has finished processing since the last look.
  // Cheap, and saves needing a cron (Vercel's 2-cron cap is already used).
  await refreshRecordingStatuses().catch(() => undefined);

  const [recordings, courses, liveRooms] = await Promise.all([
    prisma.recordingSync.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        resources: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, url: true, kind: true, sizeBytes: true },
        },
      },
    }),
    prisma.course.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, order: true, videoUrl: true },
        },
      },
    }),
    prisma.liveRoom.findMany({
      orderBy: { scheduledStart: "desc" },
      take: 30,
      select: { id: true, title: true, scheduledStart: true, mediaUrl: true },
    }),
  ]);

  // Resolve a "view as a learner" URL for anything already published, so the
  // admin can jump straight to the page a client sees. Modules need their
  // course id, which isn't on the recording row — look them up in one query.
  const publishedModuleIds = recordings
    .map((r) => r.publishedModuleId)
    .filter((id): id is string => Boolean(id));
  const modules = publishedModuleIds.length
    ? await prisma.module.findMany({
        where: { id: { in: publishedModuleIds } },
        select: { id: true, courseId: true },
      })
    : [];
  const courseIdByModule = Object.fromEntries(
    modules.map((m) => [m.id, m.courseId]),
  );

  const withPreview = recordings.map((r) => {
    let previewUrl: string | null = null;
    if (r.publishedModuleId && courseIdByModule[r.publishedModuleId]) {
      previewUrl = `/portal/training/${courseIdByModule[r.publishedModuleId]}/${r.publishedModuleId}`;
    } else if (r.publishedLiveRoomId) {
      previewUrl = `/live/${r.publishedLiveRoomId}`;
    }
    return { ...r, previewUrl };
  });

  return NextResponse.json({
    configured: { zoom: zoomConfigured(), vimeo: vimeoConfigured() },
    recordings: withPreview,
    courses,
    liveRooms,
  });
}
