import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 *   GET    /api/notes/[noteId] — fetch one
 *   PATCH  /api/notes/[noteId] — update title / body / pinned
 *   DELETE /api/notes/[noteId] — remove
 *
 * Any staff member can edit any note (notes are a shared team scratchpad).
 * CLIENTs are forbidden at every verb.
 */

function requireStaff(role?: string) {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { noteId } = await params;
  const note = await prisma.note.findUnique({
    where: { id: noteId },
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
  if (!note)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { noteId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: { title?: string; body?: string; pinned?: boolean } = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t)
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 },
      );
    data.title = t.slice(0, 200);
  }
  if (typeof body.body === "string") data.body = body.body;
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const note = await prisma.note.update({
    where: { id: noteId },
    data,
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
  return NextResponse.json(note);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!requireStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { noteId } = await params;
  try {
    await prisma.note.delete({ where: { id: noteId } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
