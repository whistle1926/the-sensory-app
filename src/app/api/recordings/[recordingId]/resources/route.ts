/**
 * Resources attached to a recording — handouts, slides, links that belong
 * with the video. Learners see them on the lesson page alongside it.
 *
 *   POST { title, url, kind?, mimeType?, sizeBytes? }
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { recordingId } = await params;

  const rec = await prisma.recordingSync.findUnique({
    where: { id: recordingId },
    select: { id: true },
  });
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    url?: string;
    kind?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "A file or link is required." }, { status: 400 });
  // http(s) only — never hand a javascript:/data: URL to a learner.
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "Links must start with http:// or https://" },
      { status: 400 },
    );
  }

  const last = await prisma.recordingResource.findFirst({
    where: { recordingId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.recordingResource.create({
    data: {
      recordingId,
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim().slice(0, 200)
          : "Resource",
      url,
      kind: body.kind === "link" ? "link" : "file",
      mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : null,
      order: (last?.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ resource: created }, { status: 201 });
}
