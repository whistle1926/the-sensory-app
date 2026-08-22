/**
 * One-tap triage from the notification email.
 *
 * The email tells you a ticket landed; this lets you answer it from a phone
 * between meetings without signing in — either "get on with this" or "park
 * it until I look".
 *
 * Three deliberate constraints:
 *
 *   - The link only ever OPENS a page. Mail clients, spam filters and link
 *     scanners follow links in the background as a matter of course, so a
 *     link that changed state would be triggered by a robot before you read
 *     the email. The change happens on a POST from that page.
 *   - The token is random and STORED on the ticket, not derived from a
 *     shared secret. A derived token silently failed in production while
 *     working locally, and a stored one can also be revoked by clearing it.
 *   - Only two harmless, reversible states can be set this way. Nothing
 *     destructive or commercial — no deleting, no refunds, no putting a
 *     course on sale — is ever reachable from an email.
 */
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export type TriageAction = "action" | "park";

/** The ticket's current token, minted on first use. */
export async function ensureTriageToken(taskId: string): Promise<string | null> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { triageToken: true },
    });
    if (!task) return null;
    if (task.triageToken) return task.triageToken;
    const token = randomBytes(18).toString("base64url");
    await prisma.task.update({ where: { id: taskId }, data: { triageToken: token } });
    return token;
  } catch {
    return null;
  }
}

export async function verifyTriageToken(
  taskId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { triageToken: true },
  });
  return !!task?.triageToken && task.triageToken === token;
}

/** The link that goes in the email. */
export async function triageUrl(
  base: string,
  taskId: string,
  userId: string,
): Promise<string | null> {
  const token = await ensureTriageToken(taskId);
  if (!token) return null;
  return `${base}/t/${taskId}?u=${encodeURIComponent(userId)}&k=${token}`;
}
