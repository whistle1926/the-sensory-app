/**
 * Read, autosave and delete a page.
 *
 * PATCH writes to `draft` only — the live page is untouched until Publish, so
 * a visitor never sees a half-written sentence.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanBlocks } from "@/lib/page-blocks";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
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
  return NextResponse.json(page);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { pageId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Settings apply immediately; content goes to the draft.
  const data: Record<string, unknown> = {};
  if (typeof body.showInNav === "boolean") data.showInNav = body.showInNav;
  if (typeof body.navLabel === "string") data.navLabel = body.navLabel.trim().slice(0, 60) || null;
  if (typeof body.isPublished === "boolean") data.isPublished = body.isPublished;

  const draft: Record<string, unknown> = {};
  if (typeof body.title === "string") draft.title = body.title.trim().slice(0, 160);
  if (typeof body.seoTitle === "string") draft.seoTitle = body.seoTitle.trim().slice(0, 200);
  if (typeof body.seoDescription === "string")
    draft.seoDescription = body.seoDescription.trim().slice(0, 400);
  if (body.blocks !== undefined) draft.blocks = cleanBlocks(body.blocks);

  if (Object.keys(draft).length > 0) {
    data.draft = draft as unknown as Prisma.InputJsonValue;
  }

  const page = await prisma.page.update({ where: { id: pageId }, data });
  return NextResponse.json(page);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { pageId } = await params;
  await prisma.page.delete({ where: { id: pageId } });
  return NextResponse.json({ ok: true });
}
