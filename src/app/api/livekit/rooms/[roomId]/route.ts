import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 *   PATCH /api/livekit/rooms/[roomId]   — Go Live / End / Cancel
 *   DELETE /api/livekit/rooms/[roomId]  — remove a scheduled session
 *
 * Only the host or staff (SUPER_ADMIN / TEAM_MANAGER) can change status.
 */
function requireStaff(role?: string) {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { roomId } = await params;
  const room = await prisma.liveRoom.findUnique({
    where: { id: roomId },
    select: { id: true, hostId: true, status: true },
  });
  if (!room)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    requireStaff(session.user.role) || session.user.id === room.hostId;
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!["scheduled", "live", "ended", "cancelled"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === "live") data.actualStart = new Date();
    if (body.status === "ended") data.actualEnd = new Date();
  }
  if (typeof body.title === "string") data.title = body.title.slice(0, 200);
  if (typeof body.description === "string")
    data.description = body.description.slice(0, 2000);
  if (typeof body.mode === "string" && ["broadcast", "interactive"].includes(body.mode))
    data.mode = body.mode;
  if (typeof body.requireAuth === "boolean") data.requireAuth = body.requireAuth;
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 4000);

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.liveRoom.update({
    where: { id: roomId },
    data,
    select: { id: true, status: true, title: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { roomId } = await params;
  try {
    await prisma.liveRoom.delete({ where: { id: roomId } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
