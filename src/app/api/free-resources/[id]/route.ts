import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function staff() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") return null;
  return session.user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await staff())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 200);
  if (typeof body.description === "string") data.description = body.description.slice(0, 1000);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.thumbnailUrl === "string") data.thumbnailUrl = body.thumbnailUrl || null;
  if (typeof body.fileUrl === "string" && body.fileUrl) data.fileUrl = body.fileUrl;
  const updated = await prisma.freeResource.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await staff())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  // Leads go with it — they only exist in relation to the download.
  await prisma.freeResource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
