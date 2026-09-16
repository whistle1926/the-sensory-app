import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; documentId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId, documentId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  // Scope the delete to the client so an id from another folder can't be removed.
  await prisma.clientDocument.deleteMany({ where: { id: documentId, clientId } });
  return NextResponse.json({ ok: true });
}
