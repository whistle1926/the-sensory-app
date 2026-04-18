import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Team-wide scratch notes.
 *
 *   GET  /api/notes — list all notes (pinned first, then newest-updated)
 *   POST /api/notes — create a note ({ title, body?, pinned? })
 *
 * Staff-only (SUPER_ADMIN / TEAM_MANAGER). CLIENT role is refused.
 */

function requireStaff(role?: string) {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const notes = await prisma.note.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const note = await prisma.note.create({
    data: {
      title: title.slice(0, 200),
      body: typeof body.body === "string" ? body.body : "",
      pinned: !!body.pinned,
      authorId: session.user.id,
    },
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(note, { status: 201 });
}
