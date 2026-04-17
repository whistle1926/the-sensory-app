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

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = await prisma.programmeTemplate.findMany({
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const sections = sanitiseSections(body.sections);

  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  // Place new programmes at the end by default.
  const last = await prisma.programmeTemplate.findFirst({
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const created = await prisma.programmeTemplate.create({
    data: {
      title,
      description,
      // Prisma types Json as InputJsonValue — Section[] plain objects satisfy
      // that shape at runtime but not structurally. Cast once, explicitly.
      sections: sections as unknown as object,
      orderIndex: (last?.orderIndex ?? 0) + 1,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
