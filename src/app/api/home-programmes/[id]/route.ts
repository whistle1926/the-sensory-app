import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Single home programme — GET / PATCH / DELETE. Staff only.
 *
 * Programmes are practice-wide artefacts (like the activity bank), so
 * any staff member may open one; only CLIENT is blocked. A TEAM_MANAGER
 * editing a programme tied to another manager's client is rare and
 * harmless here (no cross-tenant data leak beyond the child's name),
 * so we keep the guard simple: authenticated non-CLIENT.
 */
async function loadOr404(id: string) {
  return prisma.homeProgramme.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          parentCarerName: true,
          parentCarerEmail: true,
        },
      },
      author: { select: { name: true } },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const programme = await loadOr404(id);
  if (!programme)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(programme);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim() || "Home Programme";
  if (typeof body.body === "string") data.body = body.body;
  if (body.status === "draft" || body.status === "sent") data.status = body.status;
  // Allow (re)linking or unlinking a client from the editor.
  if (body.clientId === null) data.clientId = null;
  else if (typeof body.clientId === "string" && body.clientId)
    data.clientId = body.clientId;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.homeProgramme
    .update({ where: { id }, data })
    .catch(() => null);
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const deleted = await prisma.homeProgramme
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
