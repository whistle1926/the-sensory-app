/**
 * Remove a resource from a recording. Staff-only.
 *
 * Drops the reference only — the uploaded file stays in Blob storage, so
 * re-adding the same URL restores it.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ recordingId: string; resourceId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { recordingId, resourceId } = await params;

  // Scope to the recording in the path so a stray id can't delete someone
  // else's resource.
  const existing = await prisma.recordingResource.findFirst({
    where: { id: resourceId, recordingId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.recordingResource.delete({ where: { id: resourceId } });
  return NextResponse.json({ ok: true });
}
