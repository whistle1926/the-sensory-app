import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";

/** Cross-tenant guard, mirroring the intake route in this folder. */
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
  { params }: { params: Promise<{ clientId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const docs = await prisma.clientDocument.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

/** Save metadata for a document already uploaded to blob (via
 *  /api/uploads/intake-file). Body: { url, filename, mimeType, sizeBytes, title? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;
  if (!url || !filename) {
    return NextResponse.json({ error: "Missing file details" }, { status: 400 });
  }
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : filename;

  const doc = await prisma.clientDocument.create({
    data: { clientId, url, filename, mimeType, sizeBytes, title, uploadedById: session.user.id },
  });
  return NextResponse.json(doc, { status: 201 });
}
