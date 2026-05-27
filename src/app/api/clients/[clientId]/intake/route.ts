import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";

/** Same cross-tenant guard helper used elsewhere in this folder. */
async function guardClient(clientId: string, role: string, userId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { managerId: true, parentId: true },
  });
  if (!client) return { ok: false as const, status: 404, error: "Client not found" };
  if (!canAccessClient(role as never, userId, client)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const items = await prisma.clientIntakeItem.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const item = await prisma.clientIntakeItem.create({
    data: {
      clientId,
      type: typeof body.type === "string" ? body.type : "custom",
      label: body.label.trim(),
      url: typeof body.url === "string" && body.url.trim() ? body.url.trim() : null,
      status: "pending",
    },
  });
  return NextResponse.json(item, { status: 201 });
}
