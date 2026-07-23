/**
 * Resources attached to a live session — handouts, slides, links that
 * attendees can grab from the session page instead of being emailed round.
 *
 *   GET  — list them (staff view; the public join route returns them too)
 *   POST — add one: { title, url, kind?, mimeType?, sizeBytes? }
 *          kind "file" (already uploaded to Blob) or "link" (external URL)
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { roomId } = await params;
  const resources = await prisma.liveRoomResource.findMany({
    where: { roomId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ resources });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { roomId } = await params;

  const room = await prisma.liveRoom.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    url?: string;
    kind?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "A file or link is required." }, { status: 400 });
  // Only http(s) — blocks javascript:/data: URLs being handed to attendees.
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "Links must start with http:// or https://" },
      { status: 400 },
    );
  }

  const kind = body.kind === "link" ? "link" : "file";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Resource";

  const last = await prisma.liveRoomResource.findFirst({
    where: { roomId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.liveRoomResource.create({
    data: {
      roomId,
      title,
      url,
      kind,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : null,
      order: (last?.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ resource: created }, { status: 201 });
}
