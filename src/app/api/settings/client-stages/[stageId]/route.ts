import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stageId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) {
    data.label = body.label.trim();
  }
  if (typeof body.colour === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.colour)) {
    data.colour = body.colour;
  }
  if (typeof body.order === "number") {
    data.order = body.order;
  }
  if (typeof body.isDefault === "boolean") {
    if (body.isDefault) {
      // Clear any existing default first.
      await prisma.clientStage.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    data.isDefault = body.isDefault;
  }

  const stage = await prisma.clientStage.update({ where: { id: stageId }, data });
  return NextResponse.json(stage);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stageId } = await params;

  // Check if any clients are in this stage — if so, unlink them (set stageId = null).
  await prisma.client.updateMany({
    where: { stageId },
    data: { stageId: null },
  });

  await prisma.clientStage.delete({ where: { id: stageId } });
  return NextResponse.json({ ok: true });
}
