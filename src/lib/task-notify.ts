/**
 * Tell the tech lead when something lands on the build board.
 *
 * Grace and Claire log tickets late in the evening and nothing told anyone,
 * so a ticket sat unread until Paddy happened to open the board. On a day
 * full of meetings that could be the whole day — and the reports are often
 * things clients are hitting right now, like a booking page offering one
 * slot.
 *
 * Deliberately best-effort: a failure here must never stop a ticket or a
 * comment being saved. Losing the report is far worse than losing the email.
 */
import { prisma } from "./prisma";
import { sendTransactionalEmail, escapeHtml, stripHtml } from "./email";
import { triageUrl } from "./task-triage";

/** Who gets told. Falls back to the env var when nobody is flagged. */
async function recipients(
  excludeUserId?: string,
): Promise<Array<{ id: string; address: string }>> {
  const flagged = await prisma.user.findMany({
    where: {
      notifyOnNewTask: true,
      isAutomation: false,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true, email: true, notifyEmail: true },
  });
  // A person's notification address wins over their login address.
  const list = flagged
    .map((u) => ({ id: u.id, address: (u.notifyEmail?.trim() || u.email) ?? "" }))
    .filter((x) => x.address);
  if (list.length) return list;
  const fallback = process.env.TASK_NOTIFY_EMAIL?.trim();
  return fallback ? [{ id: "", address: fallback }] : [];
}

function baseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return raw.replace(/\/$/, "") || "https://portal.thesensorysubmarine.com";
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** The two answers, side by side. Both open a page; neither acts on its own. */
async function triageBlock(
  base: string,
  taskId: string,
  userId: string,
): Promise<string> {
  if (!userId) return "";
  const url = await triageUrl(base, taskId, userId);
  if (!url) return "";
  return `<table role="presentation" style="margin:22px 0 0;border-collapse:collapse"><tr>
    <td style="padding-right:8px">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Get this actioned</a>
    </td>
    <td>
      <a href="${escapeHtml(url)}" style="display:inline-block;border:1px solid #c9cedb;color:#1a1d26;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Park until I look</a>
    </td>
  </tr></table>`;
}

function shell(title: string, lines: string[], link: string, linkLabel: string) {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f5f6f9;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:24px">
    <h1 style="margin:0 0 14px;font-size:19px;color:#1a1d26">${title}</h1>
    ${lines.join("\n")}
    <p style="margin:22px 0 0">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(linkLabel)}</a>
    </p>
  </div>
</body></html>`;
}

/** A new ticket has been logged. */
export async function notifyNewTask(taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        createdById: true,
        createdBy: { select: { name: true } },
      },
    });
    if (!task) return;

    const to = await recipients(task.createdById);
    if (!to.length) return;

    const who = task.createdBy?.name || "Someone";
    const body = task.description ? stripHtml(task.description).slice(0, 1200) : "";
    const link = `${baseUrl()}/tasks/${task.id}`;

    for (const person of to) {
      const html = shell(
        escapeHtml(task.title),
        [
          `<p style="margin:0 0 14px;font-size:13px;color:#7a8194">Logged by ${escapeHtml(who)} · ${escapeHtml(PRIORITY_LABEL[task.priority] ?? task.priority)} priority</p>`,
          body
            ? `<div style="white-space:pre-line;border-left:3px solid #2563eb;background:#f5f7fd;padding:12px 14px;font-size:14px;line-height:1.6;color:#1a1d26">${escapeHtml(body)}</div>`
            : `<p style="margin:0;font-size:14px;color:#7a8194">No detail was added.</p>`,
          await triageBlock(baseUrl(), task.id, person.id),
        ],
        link,
        "Open the ticket",
      );
      await sendTransactionalEmail({
        to: person.address,
        subject: `New task from ${who}: ${task.title}`.slice(0, 160),
        html,
      });
    }
  } catch (err) {
    console.error("[task-notify] new task email failed:", err);
  }
}

/** Someone has replied on a ticket. */
export async function notifyNewComment(commentId: string): Promise<void> {
  try {
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      select: {
        body: true,
        authorId: true,
        author: { select: { name: true, isAutomation: true } },
        task: { select: { id: true, title: true } },
      },
    });
    if (!comment?.task) return;
    // Our own automated replies shouldn't email anyone.
    if (comment.author?.isAutomation) return;

    const to = await recipients(comment.authorId);
    if (!to.length) return;

    const who = comment.author?.name || "Someone";
    const link = `${baseUrl()}/tasks/${comment.task.id}`;
    const html = shell(
      `${escapeHtml(who)} replied`,
      [
        `<p style="margin:0 0 14px;font-size:13px;color:#7a8194">On: ${escapeHtml(comment.task.title)}</p>`,
        `<div style="white-space:pre-line;border-left:3px solid #2563eb;background:#f5f7fd;padding:12px 14px;font-size:14px;line-height:1.6;color:#1a1d26">${escapeHtml(
          stripHtml(comment.body).slice(0, 1200),
        )}</div>`,
      ],
      link,
      "Open the ticket",
    );

    for (const person of to) {
      await sendTransactionalEmail({
        to: person.address,
        subject: `${who} replied: ${comment.task.title}`.slice(0, 160),
        html,
      });
    }
  } catch (err) {
    console.error("[task-notify] comment email failed:", err);
  }
}
