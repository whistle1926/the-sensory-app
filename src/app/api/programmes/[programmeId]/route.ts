import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Section {
  title: string;
  items: string[];
}

function sanitiseSections(input: unknown): Section[] {
  if (!Array.isArray(input)) return [];
  const result: Section[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { title?: unknown; items?: unknown };
    const title = typeof e.title === "string" ? e.title.trim() : "";
    const items = Array.isArray(e.items)
      ? e.items
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
    if (!title && items.length === 0) continue;
    result.push({ title, items });
  }
  return result;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ programmeId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { programmeId } = await params;
  const programme = await prisma.programmeTemplate.findUnique({
    where: { id: programmeId },
  });
  if (!programme)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(programme);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ programmeId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { programmeId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title)
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    data.title = title;
  }
  if (typeof body.description === "string")
    data.description = body.description.trim();
  if (body.sections !== undefined)
    data.sections = sanitiseSections(body.sections) as unknown as object;
  if (typeof body.orderIndex === "number") data.orderIndex = body.orderIndex;

  const updated = await prisma.programmeTemplate.update({
    where: { id: programmeId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ programmeId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { programmeId } = await params;
  await prisma.programmeTemplate.delete({ where: { id: programmeId } });
  return NextResponse.json({ ok: true });
}
