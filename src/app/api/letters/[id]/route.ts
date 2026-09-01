import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * Single letter — GET / PATCH / DELETE. Staff only (non-CLIENT), same
 * practice-wide-artefact model as home programmes.
 */
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
  const letter = await prisma.letter.findUnique({
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
  if (!letter)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(letter);
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
  if (typeof body.title === "string") data.title = body.title.trim() || "Letter";
  if (typeof body.recipient === "string")
    data.recipient = body.recipient.slice(0, 500);
  // Body is rich text from the editor — sanitise on the way in.
  if (typeof body.body === "string")
    data.body = sanitizeRichText(body.body).slice(0, 40_000);
  if (body.status === "draft" || body.status === "sent") data.status = body.status;
  if (body.clientId === null) data.clientId = null;
  else if (typeof body.clientId === "string" && body.clientId)
    data.clientId = body.clientId;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.letter
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
  const deleted = await prisma.letter
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
