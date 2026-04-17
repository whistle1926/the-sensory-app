import { prisma } from "@/lib/prisma";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /**
   * Override the sender email for this send. Uses EmailSettings.senderEmail
   * by default. Useful for system emails where we don't want the therapist's
   * personal address stamped on the From field.
   */
  fromOverride?: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Shared Mailcub transport used by every transactional email in the app.
 *
 * Caller is expected to:
 *   - Wrap this in try/catch if the surrounding action must not fail on email
 *     errors (e.g. form submissions must persist even if notification fails).
 *   - Call once per recipient — Mailcub's API takes a single `to`.
 *
 * Returns `{ ok: false }` instead of throwing when the provider responds with
 * an error so the caller can decide how to react. Actual network errors still
 * throw so the calling code can log them distinctly.
 */
export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.enabled || !settings.apiKey || !settings.senderEmail) {
    return {
      ok: false,
      error: "Email is not configured. Set up Mailcub in Settings.",
    };
  }

  const text = input.text ?? stripHtml(input.html);
  const body: Record<string, unknown> = {
    to: input.to,
    from: input.fromOverride ?? settings.senderEmail,
    subject: input.subject,
    html: input.html,
    text,
  };
  if (input.replyTo) body.replyTo = input.replyTo;

  const res = await fetch("https://api.mail.mailcub.com/api/send_email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sh-key": settings.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[email] Mailcub error", res.status, errText);
    return {
      ok: false,
      statusCode: res.status,
      error: `Mailcub returned ${res.status}`,
    };
  }

  return { ok: true, statusCode: res.status };
}

/**
 * Plain-text fallback generated from HTML. Strips tags, preserves newlines
 * between block elements, collapses whitespace.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|tr|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * HTML-escape a single string for safe inclusion inside an email template.
 * Use for user-provided content that flows into the HTML body.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
