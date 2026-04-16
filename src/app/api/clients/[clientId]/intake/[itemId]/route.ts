import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (typeof body.url === "string") data.url = body.url.trim() || null;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.fileUrl === "string") data.fileUrl = body.fileUrl.trim() || null;

  if (typeof body.status === "string") {
    const valid = ["pending", "sent", "completed"];
    if (valid.includes(body.status)) {
      data.status = body.status;
      if (body.status === "sent" && !data.sentAt) data.sentAt = new Date();
      if (body.status === "completed") data.completedAt = new Date();
    }
  }

  const item = await prisma.clientIntakeItem.update({ where: { id: itemId }, data });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;
  await prisma.clientIntakeItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
