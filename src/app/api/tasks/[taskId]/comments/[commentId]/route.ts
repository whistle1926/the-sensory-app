import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText, richTextToPlain } from "@/lib/rich-text";

/**
 * Edit / delete a single comment.
 *
 * Who may change one:
 *  - its author, and
 *  - any SUPER_ADMIN.
 *
 * The SUPER_ADMIN case is the point of this route: comments posted by the
 * hourly maintenance agent are authored by a service account, so without it
 * nobody could correct or remove them. Clients can never edit, even their own —
 * the thread is a record the practice relies on.
 */
async function loadComment(commentId: string, taskId: string) {
  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { id: true, taskId: true, authorId: true },
  });
  if (!comment || comment.taskId !== taskId) return null;
  return comment;
}

function mayModify(
  comment: { authorId: string },
  user: { id: string; role: string },
): boolean {
  if (user.role === "CLIENT") return false;
  return comment.authorId === user.id || user.role === "SUPER_ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { taskId, commentId } = await params;
  const comment = await loadComment(commentId, taskId);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!mayModify(comment, session.user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = sanitizeRichText(typeof body?.body === "string" ? body.body : "");
  const plain = richTextToPlain(text);

  // An edit may not empty a comment — deleting is a separate, explicit action.
  if (!plain) {
    return NextResponse.json(
      { error: "Comment cannot be empty" },
      { status: 400 },
    );
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: "Comment is too long" }, { status: 400 });
  }

  const updated = await prisma.taskComment.update({
    where: { id: commentId },
    data: { body: text },
    include: {
      author: { select: { id: true, name: true, role: true } },
      attachments: true,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { taskId, commentId } = await params;
  const comment = await loadComment(commentId, taskId);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!mayModify(comment, session.user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Attachments cascade via the schema relation.
  await prisma.taskComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
