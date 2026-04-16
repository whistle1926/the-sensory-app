import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/rich-text";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { noteId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.sessionDate) {
    const d = new Date(body.sessionDate);
    if (!Number.isNaN(d.getTime())) data.sessionDate = d;
  }
  if (typeof body.body === "string") {
    data.body = sanitizeRichText(body.body);
  }

  const note = await prisma.progressNote.update({
    where: { id: noteId },
    data,
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { noteId } = await params;
  await prisma.progressNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
