import { prisma } from "./prisma";

interface SendMailOptions {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email via the configured Mailcub provider.
 * Returns true on success, false on any failure (including missing config).
 * Never throws — callers should treat email as best-effort.
 */
export async function sendMail(opts: SendMailOptions): Promise<boolean> {
  try {
    const settings = await prisma.emailSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings?.enabled || !settings.apiKey || !settings.senderEmail) {
      return false;
    }

    // Mailcub's send_email schema (verified empirically 2026-05-25):
    //   receiver    — string, the To address
    //   email_from  — string, the From address (must be a verified sender)
    //   subject     — string
    //   html / text — bodies
    //   cc          — ARRAY of strings (rejected as a bare string)
    //   sender_name / email_from_name are NOT supported by the API,
    //   the display name comes from whatever Mailcub has on file for
    //   the sender record.
    const ccList = opts.cc
      ? opts.cc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const res = await fetch("https://api.mail.mailcub.com/api/send_email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sh-key": settings.apiKey,
      },
      body: JSON.stringify({
        receiver: opts.to,
        email_from: settings.senderEmail,
        subject: opts.subject,
        html: opts.html,
        text: opts.text || stripHtml(opts.html),
        ...(ccList.length > 0 ? { cc: ccList } : {}),
      }),
    });

    if (!res.ok) {
      console.error("sendMail: Mailcub error", res.status, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error("sendMail: unexpected error", err);
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildPasswordSetupEmail(params: {
  clientName: string;
  setupUrl: string;
  senderName?: string;
}): string {
  const { clientName, setupUrl, senderName = "The Sensory Submarine" } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(senderName)}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.7;">Set your password</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;font-size:15px;color:#222;">Hi ${escapeHtml(clientName)},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444;">
        Thanks for booking with us. We've created an account so you can view and manage your bookings. Set a password to get started — the link below is valid for 7 days.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${setupUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Set your password</a>
      </div>
      <p style="margin:0 0 8px;font-size:12px;color:#777;">Or copy this link:</p>
      <p style="margin:0 0 20px;font-size:12px;color:#1a1a2e;word-break:break-all;">${escapeHtml(setupUrl)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0;font-size:12px;color:#999;text-align:center;">${escapeHtml(senderName)} &middot; Occupational Therapy Services</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
