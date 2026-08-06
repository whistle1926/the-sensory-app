/**
 * A parent's own wins and questions.
 *
 * Scoped hard to the children this parent is linked to — a parent can only
 * ever read or write entries for their own child, never by passing another
 * client id.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** The children this signed-in parent is allowed to write about. */
async function myClients(userId: string) {
  return prisma.client.findMany({
    where: { parentId: userId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const clients = await myClients(session.user.id);
  const entries = clients.length
    ? await prisma.parentEntry.findMany({
        where: { clientId: { in: clients.map((c) => c.id) } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, kind: true, body: true, createdAt: true, clientId: true, seenAt: true },
      })
    : [];

  return NextResponse.json({ clients, entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind === "question" ? "question" : "win";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > 4_000) {
    return NextResponse.json({ error: "That's a bit long — keep it under 4000 characters." }, { status: 400 });
  }

  const clients = await myClients(session.user.id);
  if (clients.length === 0) {
    return NextResponse.json(
      { error: "Your account isn't linked to a child yet. Let us know and we'll sort it." },
      { status: 400 },
    );
  }
  // Respect an explicit choice, but only among this parent's own children.
  const requested = typeof body.clientId === "string" ? body.clientId : "";
  const clientId = clients.find((c) => c.id === requested)?.id ?? clients[0].id;

  const entry = await prisma.parentEntry.create({
    data: { clientId, authorId: session.user.id, kind, body: text },
    select: { id: true, kind: true, body: true, createdAt: true, clientId: true, seenAt: true },
  });
  return NextResponse.json({ entry }, { status: 201 });
}
