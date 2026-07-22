/**
 * Retry a failed recording sync.
 *
 * The normal ingest is idempotent on the Zoom meeting UUID, so a row that
 * landed in "failed" would never be picked up again by a webhook or an
 * import. This gives that row a second chance: re-fetch the recording from
 * Zoom and re-run the Vimeo upload in place.
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retryRecording } from "@/lib/recording-sync";

// The Vimeo hand-off is a single fast call, but Zoom's lookup can be slow.
export const maxDuration = 120;

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { recordingId } = await params;
  const existing = await prisma.recordingSync.findUnique({
    where: { id: recordingId },
    select: { status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Nothing to retry if it's already working or done — avoid kicking off a
  // duplicate Vimeo upload for the same recording.
  if (["uploading", "transcoding", "ready"].includes(existing.status)) {
    return NextResponse.json(
      { error: "This recording is already uploaded or in progress." },
      { status: 400 },
    );
  }

  const error = await retryRecording(recordingId);
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
