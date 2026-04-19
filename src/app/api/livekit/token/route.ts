import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Issue a LiveKit JWT for the given room.
 *
 *   POST /api/livekit/token { roomId: string }
 *
 * Permissions:
 *   - Host / SUPER_ADMIN / TEAM_MANAGER → canPublish: true + canPublishData: true
 *   - Everyone else → canPublish depends on room.mode:
 *       broadcast  → false (watch-only)
 *       interactive → true  (everyone can publish)
 *
 * We use the signed-in user's name + id when available; otherwise we pick
 * a short random identity so the viewer can still connect anonymously.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_WS_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit is not configured on the server." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const roomId =
    typeof body?.roomId === "string" && body.roomId ? body.roomId : null;
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  const room = await prisma.liveRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      livekitRoomName: true,
      mode: true,
      status: true,
      hostId: true,
      requireAuth: true,
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status === "cancelled") {
    return NextResponse.json(
      { error: "This session has been cancelled." },
      { status: 410 },
    );
  }

  const session = await auth();
  const user = session?.user ?? null;

  if (room.requireAuth && !user) {
    return NextResponse.json(
      { error: "Sign in to join this session." },
      { status: 401 },
    );
  }

  const isStaff = user?.role === "SUPER_ADMIN" || user?.role === "TEAM_MANAGER";
  const isHost = !!user?.id && user.id === room.hostId;
  const canPublish =
    isStaff || isHost || room.mode === "interactive" ? true : false;

  const identity =
    user?.id ??
    `guest-${Math.random().toString(36).slice(2, 10)}`;
  const name = user?.name ?? "Guest";

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: 60 * 60 * 4, // 4-hour session window
  });
  token.addGrant({
    room: room.livekitRoomName,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    token: jwt,
    wsUrl,
    room: {
      id: room.id,
      name: room.livekitRoomName,
      mode: room.mode,
      status: room.status,
    },
    identity,
    canPublish,
    isHost,
  });
}
