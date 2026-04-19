import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 *   POST /api/livekit/rooms  — create a new live session (staff only)
 *
 * Body:
 *   {
 *     title: string                // required
 *     description?: string
 *     mode?: "broadcast" | "interactive"   // default broadcast
 *     scheduledStart?: ISO string           // default now
 *     scheduledEnd?: ISO string
 *     requireAuth?: boolean                 // default false
 *     hostId?: string                        // default = current user
 *   }
 */
function requireStaff(role?: string) {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

function slugify(t: string): string {
  const base = t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "session"}-${randomBytes(3).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const mode = body.mode === "interactive" ? "interactive" : "broadcast";
  const scheduledStart = body.scheduledStart
    ? new Date(body.scheduledStart)
    : new Date();
  if (Number.isNaN(scheduledStart.getTime())) {
    return NextResponse.json(
      { error: "Invalid scheduledStart" },
      { status: 400 },
    );
  }

  const room = await prisma.liveRoom.create({
    data: {
      title: title.slice(0, 200),
      description:
        typeof body.description === "string"
          ? body.description.slice(0, 2000)
          : "",
      mode,
      scheduledStart,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
      requireAuth: !!body.requireAuth,
      hostId:
        typeof body.hostId === "string" && body.hostId
          ? body.hostId
          : session.user.id,
      livekitRoomName: slugify(title),
      status: "scheduled",
    },
    select: { id: true, livekitRoomName: true, title: true },
  });

  return NextResponse.json(room, { status: 201 });
}
