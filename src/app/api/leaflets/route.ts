import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const rows = await prisma.leaflet.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 160)
      : "";
  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const fileUrl = typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
  if (!fileUrl || !/^https?:\/\//i.test(fileUrl))
    return NextResponse.json(
      { error: "A valid file URL is required" },
      { status: 400 },
    );

  const data = {
    title,
    description:
      typeof body?.description === "string"
        ? body.description.trim().slice(0, 2000)
        : null,
    category:
      typeof body?.category === "string" && body.category.trim()
        ? body.category.trim().slice(0, 80)
        : null,
    fileUrl,
    fileName:
      typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : null,
    mimeType:
      typeof body?.mimeType === "string" ? body.mimeType.slice(0, 80) : null,
    sizeBytes:
      typeof body?.sizeBytes === "number" && body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : null,
    thumbnailUrl:
      typeof body?.thumbnailUrl === "string" ? body.thumbnailUrl : null,
    tags: Array.isArray(body?.tags)
      ? body.tags.filter((t: unknown): t is string => typeof t === "string")
      : [],
    external: body?.external === true,
    createdById: session.user.id,
  };

  const created = await prisma.leaflet.create({ data });
  return NextResponse.json(created, { status: 201 });
}
