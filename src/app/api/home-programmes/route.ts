import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Home Programmes collection — staff only (no CLIENT access; parents
 * receive programmes by email, they don't browse the library).
 *
 * GET  → list, newest first, with the linked client's name.
 * POST → create a new (usually blank) programme and return it so the
 *        page can redirect straight into the editor.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const programmes = await prisma.homeProgramme.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      sentAt: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(programmes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clientId =
    typeof body.clientId === "string" && body.clientId ? body.clientId : null;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Home Programme";
  const initialBody = typeof body.body === "string" ? body.body : "";

  // If a client was supplied, confirm it exists (and, for managers,
  // that it's theirs) so we never dangle an FK to another tenant.
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, managerId: true },
    });
    if (!client)
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    if (
      session.user.role === "TEAM_MANAGER" &&
      client.managerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const programme = await prisma.homeProgramme.create({
    data: {
      clientId,
      authorId: session.user.id,
      title,
      body: initialBody,
    },
    select: { id: true },
  });

  return NextResponse.json(programme, { status: 201 });
}
