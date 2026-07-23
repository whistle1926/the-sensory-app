/**
 * Remove a resource from a live session. Staff-only.
 *
 * Deletes the reference only — an uploaded file stays in Blob storage, which
 * keeps this cheap and reversible (re-add the same URL to restore it).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string; resourceId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { roomId, resourceId } = await params;

  // Scope the delete to the room in the URL so a stray id can't remove a
  // resource belonging to a different session.
  const existing = await prisma.liveRoomResource.findFirst({
    where: { id: resourceId, roomId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.liveRoomResource.delete({ where: { id: resourceId } });
  return NextResponse.json({ ok: true });
}
