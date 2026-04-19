import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/livekit/rooms/[roomId]/info — room metadata for both the admin
 * detail page and the public viewer page. Returns only non-sensitive
 * fields; the viewer uses this to know the title + mode before joining.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = await prisma.liveRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      title: true,
      description: true,
      mode: true,
      status: true,
      scheduledStart: true,
      actualStart: true,
      actualEnd: true,
      requireAuth: true,
      brandingTitle: true,
      brandingLogoUrl: true,
      host: { select: { id: true, name: true } },
    },
  });
  if (!room)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Require-auth gate: if the room is auth-gated and the caller isn't
  // signed in, reject here so we don't leak the title to crawlers.
  if (room.requireAuth) {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json(
        { error: "Sign in required" },
        { status: 401 },
      );
  }

  return NextResponse.json(room);
}
