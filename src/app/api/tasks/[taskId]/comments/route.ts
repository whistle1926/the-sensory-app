import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Comments are readable/writable by:
 * - Admins (SUPER_ADMIN, TEAM_MANAGER)
 * - The CLIENT user the task is shared with (task.clientUserId === session.user.id)
 * This endpoint is used from both the admin task detail page and the
 * portal feedback page.
 */
async function loadTaskForUser(taskId: string, userId: string, role: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, clientUserId: true },
  });
  if (!task) return null;
  if (role === "CLIENT" && task.clientUserId !== userId) return null;
  return task;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { taskId } = await params;
  const task = await loadTaskForUser(taskId, session.user.id, session.user.role);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  // Parse + validate attachments array — each item needs url, mime, filename, size.
  type AttachmentInput = {
    url: string;
    mimeType: string;
    filename: string;
    sizeBytes: number;
  };
  const attachmentsRaw: unknown = body?.attachments;
  const attachments: AttachmentInput[] = Array.isArray(attachmentsRaw)
    ? attachmentsRaw
        .filter((a): a is AttachmentInput =>
          !!a &&
          typeof (a as AttachmentInput).url === "string" &&
          /^https:\/\/[\w.-]*\.public\.blob\.vercel-storage\.com\//.test(
            (a as AttachmentInput).url
          ) &&
          typeof (a as AttachmentInput).mimeType === "string" &&
          typeof (a as AttachmentInput).filename === "string" &&
          typeof (a as AttachmentInput).sizeBytes === "number"
        )
        .slice(0, 10)
    : [];

  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "Comment is too long" }, { status: 400 });
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      authorId: session.user.id,
      body: text,
      attachments: {
        create: attachments.map((a) => ({
          url: a.url,
          mimeType: a.mimeType,
          filename: a.filename,
          sizeBytes: a.sizeBytes,
        })),
      },
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
      attachments: true,
    },
  });
  return NextResponse.json(comment, { status: 201 });
}
