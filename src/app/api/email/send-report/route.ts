import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REPORT_SECTION_TITLES,
  resolveSectionOrder,
  type ReportContent,
  type ReportSectionKey,
} from "@/types/report";
import { bodyToHtml as homeBodyToHtml } from "@/lib/home-programme";
import { formatSender } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { reportId, to, subject, message, isHtml, includeReport } = body;

  // Optional file attachments — each an already-uploaded Blob URL + name.
  // Included in the email as labelled download links (see buildEmailHtml).
  const attachments: Array<{ url: string; filename: string }> = Array.isArray(
    body.attachments,
  )
    ? body.attachments
        .filter(
          (a: unknown): a is { url: string; filename: string } =>
            !!a &&
            typeof (a as { url?: unknown }).url === "string" &&
            typeof (a as { filename?: unknown }).filename === "string",
        )
        .slice(0, 10)
    : [];

  if (!reportId || !to || !subject)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to))
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  // Get email settings
  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.enabled || !settings.apiKey || !settings.senderEmail) {
    return NextResponse.json(
      { error: "Email is not configured. Please set up Mailcub in Settings." },
      { status: 400 }
    );
  }

  // Get report data
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true, session: true },
  });

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const clientName = `${report.client.firstName} ${report.client.lastName}`;
  const sessionDate = new Date(report.reportDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Build HTML email — use rich HTML from editor or plain text
  const htmlBody = buildEmailHtml({
    senderName: settings.senderName,
    clientName,
    sessionDate,
    message: message || "",
    sessionNumber: report.session.sessionNumber,
    isHtml: !!isHtml,
    includeReport: includeReport !== false,
    reportContent: report.content as unknown as ReportContent,
    attachments,
    contactEmail: settings.replyTo?.trim() || "info@thesensorysubmarine.com",
  });

  // Send via Mailcub API
  try {
    const mailcubRes = await fetch("https://api.mail.mailcub.com/api/send_email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sh-key": settings.apiKey,
      },
      // Mailcub's send_email schema uses `receiver` / `email_from`
      // (NOT `to` / `from`) — see src/lib/mailer.ts. Wrong names get a
      // 400 "email_from is required".
      body: JSON.stringify({
        receiver: to,
        email_from: formatSender(settings.senderName, settings.senderEmail),
        subject,
        html: htmlBody,
        text: stripHtml(htmlBody),
      }),
    });

    if (!mailcubRes.ok) {
      const errText = await mailcubRes.text();
      console.error("Mailcub API error:", mailcubRes.status, errText);
      return NextResponse.json(
        { error: `Email provider error: ${mailcubRes.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, sentTo: to });
  } catch (err) {
    console.error("Mailcub send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}

interface EmailParams {
  senderName: string;
  clientName: string;
  sessionDate: string;
  message: string;
  sessionNumber: number;
  isHtml: boolean;
  includeReport: boolean;
  reportContent: ReportContent;
  attachments: Array<{ url: string; filename: string }>;
  contactEmail: string;
}

function buildReportSection(content: ReportContent): string {
  const c = content;
  const nl = (text: string) =>
    text ? escapeHtml(text).replace(/\n/g, "<br/>") : "";

  // Helper — only render a sub-section if it has content
  const sub = (title: string, text: string) => {
    if (!text || text === "Not assessed this session") return "";
    return `<h3 style="margin:12px 0 4px;font-size:13px;font-weight:700;color:#333;">${title}</h3>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#444;">${nl(text)}</p>`;
  };

  const heading = (title: string) =>
    `<h2 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#1a1a2e;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">${title}</h2>`;

  return `
    <!-- Report Content -->
    <div style="margin:24px 0 0;">
      <div style="background:#1a1a2e;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
        <h2 style="margin:0;font-size:17px;font-weight:700;color:#fff;">Occupational Therapy Session Report</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">

        <!-- Client Info Table -->
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;" cellpadding="0" cellspacing="0">
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;width:35%;color:#555;">Client Name</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.clientName)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Date of Birth</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.dateOfBirth)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Age</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.age)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Date of Session</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.sessionDate)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Session Number</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${String(c.clientInfo.sessionNumber)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Referring Clinician</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.referrer)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Diagnosis</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.diagnosis)}</td></tr>
          <tr><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;font-weight:700;background:#f9fafb;color:#555;">Parent/Carer Present</td><td style="border:1px solid #e5e7eb;padding:6px 12px;font-size:12px;color:#333;">${escapeHtml(c.clientInfo.parentCarer)}</td></tr>
        </table>

        ${resolveSectionOrder(c.sectionOrder)
          .map((k) => sectionEmailHtml(c, k, heading, sub, nl))
          .join("")}

        <!-- Therapist Footer -->
        <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding:16px 0 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#555;"><strong>Report prepared by:</strong> ${escapeHtml(c.therapistName)}</p>
          <p style="margin:0 0 4px;font-size:12px;color:#555;"><strong>Qualifications:</strong> ${escapeHtml(c.therapistQualifications)}</p>
          <p style="margin:0 0 4px;font-size:12px;color:#555;"><strong>Date of report:</strong> ${escapeHtml(c.reportDate)}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#555;"><strong>Review date:</strong> ${escapeHtml(c.reviewDate)}</p>
          <p style="margin:0;font-size:11px;color:#999;font-style:italic;">This report is confidential and intended for the named recipient(s) only. If you have received this report in error, please contact The Sensory Submarine immediately.</p>
        </div>
      </div>
    </div>`;
}

/**
 * Render one body section as inline-styled HTML for the email
 * template. The section order is decided by the caller against the
 * therapist's saved sectionOrder.
 *
 * `heading()` returns the styled `<h2>` for a top-level title,
 * `sub()` returns a styled `<h3>` + `<p>` pair while skipping
 * fields that are empty (so a half-filled Functional Review or
 * Observations section never shows blank subheadings to the parent).
 */
function sectionEmailHtml(
  c: ReportContent,
  key: ReportSectionKey,
  heading: (t: string) => string,
  sub: (t: string, text: string) => string,
  nl: (s: string) => string,
): string {
  const p = (text: string) =>
    `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#444;">${nl(text)}</p>`;
  switch (key) {
    case "reasonForReferral":
      return heading(REPORT_SECTION_TITLES.reasonForReferral) + p(c.reasonForReferral);
    case "sessionOverview":
      return heading(REPORT_SECTION_TITLES.sessionOverview) + p(c.sessionOverview);
    case "observations":
      return (
        heading(REPORT_SECTION_TITLES.observations) +
        sub("Sensory Responses", c.observations.sensoryResponses) +
        sub("Engagement and Participation", c.observations.engagementParticipation) +
        sub("Communication and Social Interaction", c.observations.communicationSocial) +
        sub("Emotional Regulation and Behaviour", c.observations.emotionalRegulation)
      );
    case "assessmentFindings":
      return (
        heading(REPORT_SECTION_TITLES.assessmentFindings) +
        sub("Sensory Processing", c.assessmentFindings.sensoryProcessing) +
        sub("Fine Motor Skills", c.assessmentFindings.fineMotor) +
        sub("Gross Motor Skills", c.assessmentFindings.grossMotor) +
        sub("Self-Regulation", c.assessmentFindings.selfRegulation) +
        sub("Play and Functional Skills", c.assessmentFindings.playFunctional)
      );
    case "functionalReview": {
      const fr = c.functionalReview;
      if (!fr) return "";
      const parts = [
        sub("Feeding and Eating", fr.feedingAndEating ?? ""),
        sub("Personal Care and Dressing", fr.personalCareAndDressing ?? ""),
        sub("Toileting", fr.toileting ?? ""),
        sub("Sleep", fr.sleep ?? ""),
        sub("School", fr.school ?? ""),
        sub("Any Other Concerns", fr.otherConcerns ?? ""),
        sub("Discussion with Parent/Carer", fr.discussionWithParent ?? ""),
      ];
      if (parts.every((s) => !s)) return "";
      return heading(REPORT_SECTION_TITLES.functionalReview) + parts.join("");
    }
    case "clinicalImpressions":
      return heading(REPORT_SECTION_TITLES.clinicalImpressions) + p(c.clinicalImpressions);
    case "recommendations":
      return heading(REPORT_SECTION_TITLES.recommendations) + p(c.recommendations);
    case "goals":
      return (
        heading(REPORT_SECTION_TITLES.goals) +
        sub("Short-Term Goals", c.goals.shortTerm) +
        sub("Long-Term Goals", c.goals.longTerm) +
        sub("Next Session Plan", c.goals.nextSessionPlan)
      );
    case "homeProgramme":
      // Photo-aware: demo-step image URLs render as inline <img> so the
      // step illustrations reach the parent's inbox too.
      return (
        heading(REPORT_SECTION_TITLES.homeProgramme) +
        `<div style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#444;">${homeBodyToHtml(c.homeProgrammeSuggestions)}</div>`
      );
    default:
      return "";
  }
}

function buildEmailHtml(params: EmailParams): string {
  const { senderName, clientName, sessionDate, message, sessionNumber, isHtml, includeReport, reportContent, attachments, contactEmail } = params;

  // Attachments as labelled download links (Blob-hosted). More reliable
  // than binary email attachments and free of size caps.
  const attachmentsBlock =
    attachments.length > 0
      ? `<div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:0 0 20px 0;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1a1a2e;">
            📎 Attachment${attachments.length === 1 ? "" : "s"}
          </p>
          ${attachments
            .map(
              (a) =>
                `<p style="margin:0 0 6px;font-size:14px;">
                  <a href="${escapeHtml(a.url)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(a.filename)}</a>
                </p>`,
            )
            .join("")}
          <p style="margin:6px 0 0;font-size:11px;color:#888;">Click a file name to open or download it.</p>
        </div>`
      : "";

  // If the message came from the rich text editor, use it directly
  // Otherwise escape and convert newlines
  const messageBlock = isHtml
    ? `<div style="margin:0 0 20px 0;line-height:1.6;color:#333;">${message}</div>`
    : message
      ? `<p style="margin:0 0 20px 0;line-height:1.6;color:#333;">${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`
      : "";

  const reportBlock = includeReport && reportContent
    ? buildReportSection(reportContent)
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Brand band: Cara's submarine logo above the dark title card.
         Absolute URL so email clients fetch it correctly outside the
         portal domain. -->
    <div style="text-align:center;padding:8px 0 12px;">
      <img src="https://portal.thesensorysubmarine.com/brand/logo.jpg"
           alt="The Sensory Submarine"
           width="120" height="120"
           style="display:inline-block;width:120px;height:auto;border:0;outline:none;" />
    </div>
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(senderName)}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.7;">Occupational Therapy Report</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
      ${messageBlock}
      ${attachmentsBlock}
      <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;color:#555;">
          <strong>Client:</strong> ${escapeHtml(clientName)}<br/>
          <strong>Session ${sessionNumber}:</strong> ${escapeHtml(sessionDate)}
        </p>
      </div>
      ${reportBlock}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-align:center;">
        ${escapeHtml(senderName)} &middot; Occupational Therapy Services
      </p>
      <p style="margin:0;font-size:11px;color:#bbb;text-align:center;">
        Questions? Email us at
        <a href="mailto:${escapeHtml(contactEmail)}" style="color:#999;">${escapeHtml(contactEmail)}</a>.
      </p>
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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "\u00b7")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
