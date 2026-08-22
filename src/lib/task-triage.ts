/**
 * One-tap triage from the notification email.
 *
 * The email tells you a ticket landed; this lets you answer it from a phone
 * between meetings without signing in — either "get on with this" or "park
 * it until I look".
 *
 * Two deliberate constraints:
 *
 *   - The link only ever OPENS a page. Mail clients, spam filters and link
 *     scanners follow links in the background as a matter of course, so a
 *     link that changed state would be triggered by a robot before you read
 *     the email. The change happens on a POST from that page.
 *   - Only these two harmless, reversible states can be set this way.
 *     Nothing destructive or commercial — no deleting, no refunds, no
 *     putting a course on sale — is ever reachable from an email.
 */
import { createHmac, timingSafeEqual } from "crypto";

export type TriageAction = "action" | "park";

function secret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.CRON_SECRET ??
    "insecure-fallback"
  );
}

/** Proof that the holder received the email for this ticket. */
export function triageToken(taskId: string, userId: string): string {
  return createHmac("sha256", secret())
    .update(`${taskId}:${userId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyTriageToken(
  taskId: string,
  userId: string,
  token: string,
): boolean {
  const expected = triageToken(taskId, userId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** The link that goes in the email. */
export function triageUrl(base: string, taskId: string, userId: string): string {
  const t = triageToken(taskId, userId);
  return `${base}/t/${taskId}?u=${encodeURIComponent(userId)}&k=${t}`;
}
