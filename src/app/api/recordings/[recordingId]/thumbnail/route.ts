/**
 * Change the poster image on an already-synced recording, without
 * re-publishing it.
 *
 * Thumbnails can be set while publishing, but you often want to swap one
 * later (better artwork, rebrand, wrong image first time). This applies a new
 * image to the Vimeo video in place — the lesson it's attached to is
 * untouched, and learners see the new picture immediately.
 *
 * POST { thumbnailUrl }   — an image already uploaded to Blob storage
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setThumbnail } from "@/lib/vimeo";

export const maxDuration = 120;

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
  const rec = await prisma.recordingSync.findUnique({
    where: { id: recordingId },
    select: { vimeoUri: true, status: true },
  });
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rec.vimeoUri) {
    return NextResponse.json(
      { error: "This recording hasn't reached Vimeo yet." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { thumbnailUrl?: string };

  // Clearing the thumbnail: we can't un-set a Vimeo picture, but we can stop
  // tracking ours so the UI stops claiming a custom image is in place.
  if (!body.thumbnailUrl) {
    await prisma.recordingSync.update({
      where: { id: recordingId },
      data: { thumbnailUrl: null },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const warning = await setThumbnail(rec.vimeoUri, body.thumbnailUrl);
  if (warning) return NextResponse.json({ error: warning }, { status: 502 });

  await prisma.recordingSync.update({
    where: { id: recordingId },
    data: { thumbnailUrl: body.thumbnailUrl },
  });
  return NextResponse.json({ ok: true });
}
