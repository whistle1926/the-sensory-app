import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leafletId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { leafletId } = await params;
  const leaflet = await prisma.leaflet.findUnique({ where: { id: leafletId } });
  if (!leaflet)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(leaflet);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leafletId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { leafletId } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    const t = body.title.trim().slice(0, 160);
    if (!t)
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    data.title = t;
  }
  if (typeof body?.description === "string")
    data.description = body.description.trim().slice(0, 2000);
  if (typeof body?.category === "string")
    data.category = body.category.trim().slice(0, 80) || null;
  if (
    typeof body?.kind === "string" &&
    ["content", "file", "link"].includes(body.kind)
  ) {
    data.kind = body.kind;
    // If the caller is converting to/from content, they should also send the
    // correct content/fileUrl. We wipe the other field so the model stays
    // consistent with the new kind.
    if (body.kind === "content") {
      data.fileUrl = null;
      data.external = false;
    } else {
      data.content = null;
      data.external = body.kind === "link";
    }
  }
  if (typeof body?.content === "string") data.content = body.content;
  if (typeof body?.fileUrl === "string" && /^https?:\/\//i.test(body.fileUrl))
    data.fileUrl = body.fileUrl.trim();
  if (typeof body?.fileName === "string")
    data.fileName = body.fileName.slice(0, 200);
  if (typeof body?.mimeType === "string")
    data.mimeType = body.mimeType.slice(0, 80);
  if (typeof body?.sizeBytes === "number" && body.sizeBytes >= 0)
    data.sizeBytes = Math.floor(body.sizeBytes);
  if (typeof body?.thumbnailUrl === "string")
    data.thumbnailUrl = body.thumbnailUrl;
  if (Array.isArray(body?.tags))
    data.tags = body.tags.filter(
      (t: unknown): t is string => typeof t === "string",
    );
  if (typeof body?.external === "boolean") data.external = body.external;

  const updated = await prisma.leaflet.update({
    where: { id: leafletId },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ leafletId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { leafletId } = await params;
  await prisma.leaflet.delete({ where: { id: leafletId } });
  return NextResponse.json({ ok: true });
}
