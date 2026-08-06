/** Apply the draft to the live page, in one write, then clear it. */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { pageId } = await params;
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draft = (page.draft ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ["title", "seoTitle", "seoDescription", "blocks"]) {
    if (draft[k] !== undefined) data[k] = draft[k];
  }

  await prisma.page.update({
    where: { id: pageId },
    data: {
      ...data,
      draft: {} as unknown as Prisma.InputJsonValue,
      isPublished: true,
      publishedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
