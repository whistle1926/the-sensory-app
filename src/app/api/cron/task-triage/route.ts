/**
 * GET /api/cron/task-triage
 *
 * Reads any open ticket where the last word wasn't ours — either nobody has
 * answered it yet, or someone has replied since we did — and responds. A
 * report logged at 10pm therefore has an answer by morning, and a question
 * we asked doesn't go unheard when it's answered.
 *
 * Scope is deliberately narrow — it writes COMMENTS and nothing else:
 *   - it never marks anything done, and never changes a booking, price or
 *     course
 *   - it never claims something is fixed, because it hasn't looked at the code
 *   - anything needing a decision is flagged and emailed on, not guessed at
 *
 * Idempotency: a ticket is "answered" once the automation identity has
 * commented on it, so re-running is harmless.
 *
 * Runs once a day at 07:00 — Vercel's Hobby plan allows one cron run per
 * day, and the evening is when tickets tend to be logged, so a report made
 * at 10pm has an answer before the working day starts. It can also be
 * triggered by hand with the same header at any time.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triageTicket } from "@/lib/task-triage-agent";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The identity our automated comments are posted under. */
async function automationUserId(): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { isAutomation: true },
    select: { id: true },
  });
  return u?.id ?? null;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botId = await automationUserId();
  if (!botId) {
    return NextResponse.json({ error: "No automation identity" }, { status: 500 });
  }

  // Anything open where the last word wasn't ours: either nobody has
  // answered it yet, or someone has replied since we did. Without the second
  // case it would ask Grace a question and never see her answer.
  const open = await prisma.task.findMany({
    where: { status: { in: ["todo", "in_progress"] } },
    orderBy: [{ agentQueuedAt: "desc" }, { updatedAt: "desc" }],
    take: 25,
    select: {
      id: true,
      title: true,
      description: true,
      agentQueuedAt: true,
      createdBy: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 12,
        select: { body: true, createdAt: true, authorId: true, author: { select: { name: true } } },
      },
    },
  });

  const candidates = open
    .filter((t) => {
      const last = t.comments[t.comments.length - 1];
      return !last || last.authorId !== botId;
    })
    // A handful per run keeps us inside the function's time limit and stops a
    // backlog firing a burst of emails.
    .slice(0, 3);

  const handled: Array<{ id: string; category: string; needsPaddy: boolean }> = [];
  const skipped: Array<{ id: string; why: string }> = [];

  for (const task of candidates) {
    const result = await triageTicket({
      title: task.title,
      description: (task.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      loggedBy: task.createdBy?.name ?? "someone",
      existingComments: task.comments.map(
        (c) => `${c.author?.name ?? "?"}: ${c.body.replace(/<[^>]+>/g, " ").slice(0, 400)}`,
      ),
    });
    if (!result) continue;
    // Not every message deserves an answer — saying nothing is a valid outcome.
    if (!result.needsReply) {
      skipped.push({ id: task.id, why: result.summary });
      continue;
    }

    await prisma.taskComment.create({
      data: { taskId: task.id, authorId: botId, body: result.reply },
    });
    handled.push({ id: task.id, category: result.category, needsPaddy: result.needsPaddy });

    // Anything needing a person's decision goes straight to them rather than
    // sitting on a board waiting to be noticed.
    if (result.needsPaddy) {
      const people = await prisma.user.findMany({
        where: { notifyOnNewTask: true, isAutomation: false },
        select: { email: true, notifyEmail: true },
      });
      const base =
        (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "").replace(/\/$/, "") ||
        "https://portal.thesensorysubmarine.com";
      for (const p of people) {
        const to = p.notifyEmail?.trim() || p.email;
        if (!to) continue;
        await sendTransactionalEmail({
          to,
          subject: `Needs your call: ${task.title}`.slice(0, 160),
          html: `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#f5f6f9;padding:24px">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:24px">
              <h1 style="margin:0 0 10px;font-size:19px">${escapeHtml(task.title)}</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4a5061">${escapeHtml(result.summary)}</p>
              <p style="margin:0 0 18px;font-size:13px;color:#7a8194">I've replied on the board, but this one needs you to decide something before anything happens.</p>
              <a href="${escapeHtml(`${base}/tasks/${task.id}`)}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open the ticket</a>
            </div></body></html>`,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({
    ok: true,
    answered: handled.length,
    stayedQuiet: skipped.length,
    handled,
    skipped,
  });
}
