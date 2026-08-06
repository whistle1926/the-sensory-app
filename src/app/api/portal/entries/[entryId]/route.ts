/** Edit or delete your own entry. Parents can tidy what they wrote; they can
 *  never touch anyone else's. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function mine(entryId: string, userId: string) {
  const e = await prisma.parentEntry.findUnique({
    where: { id: entryId },
    select: { id: true, authorId: true },
  });
  return e && e.authorId === userId ? e : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { entryId } = await params;
  if (!(await mine(entryId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  const entry = await prisma.parentEntry.update({
    where: { id: entryId },
    data: { body: text.slice(0, 4_000) },
    select: { id: true, kind: true, body: true, createdAt: true, clientId: true, seenAt: true },
  });
  return NextResponse.json({ entry });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { entryId } = await params;
  if (!(await mine(entryId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.parentEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
