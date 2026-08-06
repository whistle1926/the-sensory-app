/** List and create editable pages. Staff only. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/page-blocks";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const pages = await prisma.page.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, slug: true, title: true, isPublished: true,
      showInNav: true, updatedAt: true, draft: true,
    },
  });
  return NextResponse.json({ pages });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { title?: unknown };
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim().slice(0, 160)
    : "New page";

  // Slugs are permanent once shared, so make it unique at creation and never
  // change it afterwards — a renamed URL is a broken link for anyone who already shared it.
  let slug = slugify(title) || "page";
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.page.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const last = await prisma.page.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const page = await prisma.page.create({
    data: { title, slug, order: (last?.order ?? -1) + 1 },
    select: { id: true, slug: true, title: true },
  });
  return NextResponse.json({ page }, { status: 201 });
}
