/**
 * Edit a synced recording.
 *
 * PATCH { topic, renameLesson?, renameOnVimeo? }
 *
 * Zoom names every recording "<host>'s Zoom Meeting", which is useless as a
 * lesson title — so renaming is the main thing you want to do here. By
 * default the new name is pushed to Vimeo as well, and optionally to the
 * course lesson it was published to, so the same title appears everywhere
 * instead of drifting apart.
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renameVideo } from "@/lib/vimeo";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { recordingId } = await params;
  const rec = await prisma.recordingSync.findUnique({
    where: { id: recordingId },
    select: { id: true, vimeoUri: true, publishedModuleId: true },
  });
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    renameLesson?: boolean;
    renameOnVimeo?: boolean;
  };

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  const title = topic.slice(0, 240);

  await prisma.recordingSync.update({
    where: { id: recordingId },
    data: { topic: title },
  });

  // Keep the Vimeo title in step (default on) — best-effort, and reported as
  // a warning rather than failing the rename we've already saved.
  let warning: string | null = null;
  if (body.renameOnVimeo !== false && rec.vimeoUri) {
    warning = await renameVideo(rec.vimeoUri, title);
  }

  // Optionally rename the lesson this was published to.
  if (body.renameLesson && rec.publishedModuleId) {
    await prisma.module
      .update({ where: { id: rec.publishedModuleId }, data: { title } })
      .catch(() => {
        warning = warning ?? "Renamed here, but the lesson title didn't update.";
      });
  }

  return NextResponse.json({ ok: true, warning });
}
