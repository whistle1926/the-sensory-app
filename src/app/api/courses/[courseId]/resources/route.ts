/**
 * Handouts attached to a course — the "couple of resources with each webinar".
 *
 * Files are uploaded straight from the browser to Vercel Blob (see
 * /api/uploads/blob) and only the resulting URL is posted here, so a big PDF
 * or PowerPoint never passes through a serverless function and can't hit the
 * ~4.5MB request cap. An external link can be added instead of a file.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/** Only our own blob storage, or a plain http(s) link. */
function safeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 1_000);
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { courseId } = await params;
  const resources = await prisma.courseResource.findMany({
    where: { courseId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ resources });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = safeUrl(body.url);
  if (!url) {
    return NextResponse.json({ error: "That doesn't look like a valid link." }, { status: 400 });
  }
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Resource";
  const kind = body.kind === "link" ? "link" : "file";

  const last = await prisma.courseResource.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const resource = await prisma.courseResource.create({
    data: {
      courseId,
      title,
      url,
      kind,
      mimeType: typeof body.mimeType === "string" ? body.mimeType.slice(0, 200) : null,
      sizeBytes:
        typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes)
          ? Math.max(0, Math.floor(body.sizeBytes))
          : null,
      order: (last?.order ?? -1) + 1,
    },
  });
  return NextResponse.json({ resource }, { status: 201 });
}
