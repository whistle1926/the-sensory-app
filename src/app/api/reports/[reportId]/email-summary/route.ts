/**
 * Send a summary of a report by email.
 *
 *   POST /api/reports/[id]/email-summary
 *     body: { to: string; cc?: string; subject: string; body: string }
 *     200: { ok: true; emailSent: boolean }
 *
 * Wraps the OT-provided plain-text body in the standard branded HTML
 * shell (header + footer matching invoice emails) and sends via the
 * shared Mailcub mailer. Staff-only, cross-tenant guarded, rate-
 * limited, and audit-logged so we have a record of who emailed what
 * summary to whom.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap the OT's text into the same dark-navy header + clean body
 *  shell we use for invoice + report emails so the recipient sees
 *  a consistent The Sensory Submarine identity. */
function buildHtml(opts: {
  body: string;
  clientName: string;
}): string {
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, "<br/>"))
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#333;">${escapeHtml(p)}</p>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">The Sensory Submarine</h1>
      <p style="margin:6px 0 0;font-size:12px;opacity:0.7;">Occupational Therapy Services</p>
    </div>
    <div style="background:#fff;padding:28px 32px;border-radius:0 0 12px 12px;">
      ${paragraphs}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;"/>
      <p style="margin:0;font-size:11px;color:#888;text-align:center;line-height:1.5;">
        This summary relates to ${escapeHtml(opts.clientName)} and is confidential —
        intended only for the named recipient. If this reached you in error,
        please reply and let us know so we can correct our records.
      </p>
    </div>
  </div>
</body></html>`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blocked = rateLimitOrReject("report.email-summary", session.user.id, {
    max: 5,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  const { reportId } = await params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessClient(session.user.role, session.user.id, report.client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    cc?: string;
    subject?: string;
    body?: string;
  };
  const to = (body.to ?? "").trim();
  const cc = (body.cc ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!to) return NextResponse.json({ error: "To is required." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Summary body is required." }, { status: 400 });

  const html = buildHtml({
    body: text,
    clientName: `${report.client.firstName} ${report.client.lastName}`,
  });

  const emailSent = await sendMail({
    to,
    cc: cc || undefined,
    subject,
    html,
    text,
  });

  if (!emailSent) {
    return NextResponse.json(
      {
        error:
          "Email failed to send. Check the Mailcub settings or your sender address, then try again.",
      },
      { status: 502 },
    );
  }

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "report.update", // closest existing verb; full summary-specific verb is overkill for v1
    targetType: "report",
    targetId: reportId,
    meta: {
      action: "summary.email",
      to,
      cc: cc || undefined,
      subject,
      clientId: report.clientId,
      clientName: `${report.client.firstName} ${report.client.lastName}`,
      length: text.length,
    },
    req,
  });

  return NextResponse.json({ ok: true, emailSent: true });
}
