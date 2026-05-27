import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * Verify the requester is allowed to touch this client's record.
 * Centralised so each handler is one line. Returns the loaded client
 * on success so callers don't double-fetch.
 */
async function guardClient(
  clientId: string,
  role: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { managerId: true, parentId: true },
  });
  if (!client) return { ok: false, status: 404, error: "Client not found" };
  if (!canAccessClient(role as never, userId, client)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { clientId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const notes = await prisma.progressNote.findMany({
    where: { clientId },
    orderBy: { sessionDate: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json(notes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { clientId } = await params;
  const g = await guardClient(clientId, session.user.role, session.user.id);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sessionDate = body.sessionDate ? new Date(body.sessionDate) : null;
  if (!sessionDate || Number.isNaN(sessionDate.getTime())) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  const sanitised = sanitizeRichText(body.body);
  if (!sanitised) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  const note = await prisma.progressNote.create({
    data: {
      clientId,
      authorId: session.user.id,
      sessionDate,
      body: sanitised,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
