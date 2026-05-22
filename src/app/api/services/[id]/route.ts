/**
 * Single service — PATCH + DELETE for the catalogue editor.
 *
 * Services have no historical FK constraints (invoice items snapshot
 * description + unitPrice at creation time), so a hard delete is
 * safe. The UI still prefers archiving (isActive=false) so a
 * mistakenly-deleted row can be recovered.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const t = body.name.trim();
    if (!t)
      return NextResponse.json(
        { error: "Name can't be empty." },
        { status: 400 },
      );
    data.name = t.slice(0, 200);
  }
  if (typeof body.description === "string")
    data.description = body.description.trim().slice(0, 5_000);
  if (typeof body.category === "string")
    data.category = body.category.trim().slice(0, 120);
  if (typeof body.pricePence === "number" && Number.isFinite(body.pricePence))
    data.pricePence = Math.max(0, Math.floor(body.pricePence));
  if (typeof body.currency === "string")
    data.currency = body.currency.trim().toUpperCase().slice(0, 3) || "GBP";
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.order === "number" && Number.isFinite(body.order))
    data.order = Math.floor(body.order);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.service.update({
    where: { id },
    data,
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const exists = await prisma.service.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
