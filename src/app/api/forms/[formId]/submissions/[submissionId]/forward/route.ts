import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { isLayoutOnly, type FormField, type UploadedFile } from "@/lib/forms";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Render one submitted value as safe HTML (string, list, or file link). */
function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return '<span style="color:#9ca3af;">—</span>';
  }
  if (Array.isArray(value)) {
    return escapeHtml(value.map(String).join(", "));
  }
  if (typeof value === "object") {
    const uf = value as UploadedFile;
    if (uf.url && uf.filename) {
      return `<a href="${escapeHtml(uf.url)}" style="color:#2563eb;">${escapeHtml(
        uf.filename,
      )}</a>`;
    }
    return escapeHtml(JSON.stringify(value));
  }
  // Preserve line breaks in long-text answers.
  return escapeHtml(String(value)).replace(/\n/g, "<br/>");
}

/**
 * Forward a completed form submission to another professional by email.
 * Staff-only. The sender (the OT) triggers this explicitly per send from
 * the submission page — we build a clean read-only copy of the answers
 * plus an optional personal note and post it via the configured mailer.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string; submissionId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId, submissionId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    to?: unknown;
    note?: unknown;
  };
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      form: { select: { id: true, title: true } },
      invite: {
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!submission || submission.formId !== formId) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const snapshot = Array.isArray(submission.fieldsSnapshot)
    ? (submission.fieldsSnapshot as unknown as FormField[])
    : [];
  const data = (submission.data ?? {}) as Record<string, unknown>;

  // Build the answer rows from the field snapshot (skip layout-only
  // fields like headings/paragraphs, which carry no answer).
  const rows = snapshot
    .filter((f) => f && f.type && !isLayoutOnly(f.type))
    .map((field) => {
      const label = escapeHtml(field.label || "(Untitled)");
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#374151;width:40%;vertical-align:top;">${label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111827;">${renderValue(
          data[field.id],
        )}</td>
      </tr>`;
    })
    .join("");

  const clientName = submission.invite?.client
    ? `${submission.invite.client.firstName} ${submission.invite.client.lastName}`
    : submission.submitterName || "";

  const sender = session.user.name || "The Sensory Submarine";
  const submittedAt = new Date(submission.submittedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subjectWho = clientName ? ` — ${clientName}` : "";
  const subject = `Referral: ${submission.form.title}${subjectWho}`;

  const noteBlock = note
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f1f5f9;border-radius:10px;color:#334155;font-size:14px;line-height:1.6;">
         <div style="font-weight:600;margin-bottom:4px;">Note from ${escapeHtml(
           sender,
         )}:</div>
         ${escapeHtml(note).replace(/\n/g, "<br/>")}
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#1a1a2e;color:#fff;padding:20px 28px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(
        submission.form.title,
      )}</h1>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.75;">Shared via The Sensory Submarine</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      ${noteBlock}
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
        ${clientName ? `Client: <strong>${escapeHtml(clientName)}</strong> &middot; ` : ""}Submitted ${escapeHtml(
          submittedAt,
        )}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        This referral was forwarded to you by ${escapeHtml(
          sender,
        )} at The Sensory Submarine. It is confidential and intended for the named recipient only.
      </p>
    </div>
  </div>
</body>
</html>`;

  const ok = await sendMail({ to, subject, html });
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "Couldn't send the email. Check that email sending is set up in Settings, then try again.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, to });
}
