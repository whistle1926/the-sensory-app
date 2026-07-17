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
 * Build the `email_from` value, with a display name when we have one, so
 * inboxes show "The Sensory Submarine" instead of the bare address.
 *
 * Mailcub has no sender_name / email_from_name field (both 400 with
 * "not allowed"), but it DOES accept the standard RFC 5322 form
 * `"Display Name" <addr@host>` — verified against the live API 2026-07-17.
 * The name is quoted and stripped of quotes/backslashes so it can't break
 * out of the header.
 */
export function formatSender(name: string | null | undefined, email: string): string {
  const clean = (name ?? "").replace(/["\\\r\n]/g, "").trim();
  return clean ? `"${clean}" <${email}>` : email;
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
  // Mailcub's API uses `receiver` / `email_from` / `subject` / `html` / `text`
  // (not the more common `to` / `from`). It also returns HTTP 200 even on
  // validation errors and signals success via a `code` field in the body —
  // so we parse the JSON and check that, not just `res.ok`.
  const body: Record<string, unknown> = {
    receiver: input.to,
    email_from: formatSender(
      settings.senderName,
      input.fromOverride ?? settings.senderEmail,
    ),
    subject: input.subject,
    html: input.html,
    text,
  };
  // NOTE: do NOT send `reply_to` — Mailcub rejects it with 400 "reply_to
  // is not allowed", which silently failed EVERY transactional email once
  // a Reply-to was configured. If a custom reply-to is needed, set it on
  // the Mailcub sender record. `input.replyTo` / EmailSettings.replyTo are
  // intentionally not forwarded to the API.

  const res = await fetch("https://api.mail.mailcub.com/api/send_email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sh-key": settings.apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
  };

  if (!res.ok || json.code !== 200) {
    console.error("[email] Mailcub error", res.status, json);
    return {
      ok: false,
      statusCode: res.status,
      error: json.message ?? `Mailcub returned ${res.status}`,
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
