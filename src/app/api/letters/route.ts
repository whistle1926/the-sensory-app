import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LETTER_TEMPLATES } from "@/lib/letter";

/**
 * Letters collection — staff only (parents/schools receive letters by
 * email or PDF; they don't browse the library).
 *
 * GET  → list, newest first, with the linked child's name.
 * POST → create a letter (optionally from a starter template) and return
 *        its id so the page can redirect straight into the editor.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const letters = await prisma.letter.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      recipient: true,
      status: true,
      sentAt: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(letters);
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

  // A starter template pre-fills the title + body; unknown/absent → blank.
  const tpl =
    (typeof body.template === "string" && LETTER_TEMPLATES[body.template]) ||
    LETTER_TEMPLATES.blank;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : tpl.title;
  const initialBody =
    typeof body.body === "string" && body.body ? body.body : tpl.body;

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

  const letter = await prisma.letter.create({
    data: {
      clientId,
      authorId: session.user.id,
      title,
      body: initialBody,
    },
    select: { id: true },
  });

  return NextResponse.json(letter, { status: 201 });
}
