import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type FormField } from "@/lib/forms";
import { escapeHtml, submissionAnswerRowsHtml } from "@/lib/submission-render";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/**
 * Printable / downloadable view of a completed submission. Returns a
 * self-contained, branded HTML page that auto-opens the browser print
 * dialog on load — the user picks "Save as PDF" to download a real PDF.
 * Opened in a new tab from the submission page. Staff-only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string; submissionId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId, submissionId } = await params;

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
  const rows = submissionAnswerRowsHtml(snapshot, data);

  const clientName = submission.invite?.client
    ? `${submission.invite.client.firstName} ${submission.invite.client.lastName}`
    : submission.submitterName || "";

  const submittedAt = new Date(submission.submittedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(submission.form.title)}${
    clientName ? ` — ${escapeHtml(clientName)}` : ""
  }</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f5f5; font-family: Arial, Helvetica, sans-serif; color: #111827; }
    .sheet { max-width: 760px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .head { background: #1a1a2e; color: #fff; padding: 24px 32px; }
    .head h1 { margin: 0; font-size: 20px; }
    .head p { margin: 4px 0 0; font-size: 12px; opacity: 0.75; }
    .body { padding: 28px 32px; }
    .meta { margin: 0 0 18px; font-size: 13px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .foot { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #9ca3af; }
    .actions { text-align: center; margin: 16px; }
    .actions button { background: #1a1a2e; color: #fff; border: 0; border-radius: 10px; padding: 10px 22px; font-size: 14px; font-weight: 600; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; margin: 0; max-width: none; border-radius: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Save as PDF / Print</button>
  </div>
  <div class="sheet">
    <div class="head">
      <h1>${escapeHtml(submission.form.title)}</h1>
      <p>The Sensory Submarine</p>
    </div>
    <div class="body">
      <p class="meta">
        ${clientName ? `Client: <strong>${escapeHtml(clientName)}</strong> &middot; ` : ""}Submitted ${escapeHtml(
          submittedAt,
        )}
      </p>
      <table><tbody>${rows}</tbody></table>
      <p class="foot">
        Confidential — Occupational Therapy referral, The Sensory Submarine.
      </p>
    </div>
  </div>
  <script>
    // Auto-open the print dialog so "Save as PDF" is one step away.
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
