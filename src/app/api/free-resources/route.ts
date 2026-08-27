/**
 * Admin CRUD for the free downloads offered on /resources.
 * Files are already on Vercel Blob by the time they reach here.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function staff() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") return null;
  return session.user;
}

export async function GET() {
  if (!(await staff())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.freeResource.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, title: true, description: true, fileUrl: true, fileName: true,
      thumbnailUrl: true, isActive: true, order: true, downloads: true,
      _count: { select: { leads: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  if (!title || !fileUrl) {
    return NextResponse.json({ error: "A title and a file are required." }, { status: 400 });
  }
  const last = await prisma.freeResource.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const created = await prisma.freeResource.create({
    data: {
      title: title.slice(0, 200),
      description: typeof body.description === "string" ? body.description.slice(0, 1000) : "",
      fileUrl,
      fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 300) : "",
      thumbnailUrl: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
      order: (last?.order ?? -1) + 1,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
