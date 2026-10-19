/**
 * POST /api/tasks/[taskId]/attachments
 *
 * Attach an already-uploaded file (via /api/uploads/comment-attachment) to
 * a ticket after it's been logged — e.g. the PDF/Word draft Grace forgot to
 * include (Oct 2026). Staff only, like the rest of the task API.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BLOB_URL = /^https:\/\/[\w.-]*\.public\.blob\.vercel-storage\.com\//;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { url, mimeType, filename, sizeBytes } = body;
  if (
    typeof url !== "string" || !BLOB_URL.test(url) ||
    typeof mimeType !== "string" || typeof filename !== "string" ||
    typeof sizeBytes !== "number"
  ) {
    return NextResponse.json({ error: "Invalid attachment" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachment = await prisma.taskAttachment.create({
    data: { taskId, url, mimeType, filename: filename.slice(0, 200), sizeBytes },
  });
  return NextResponse.json(attachment, { status: 201 });
}
