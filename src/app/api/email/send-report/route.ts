import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { reportId, to, subject, message } = body;

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

  // Build HTML email
  const htmlBody = buildEmailHtml({
    senderName: settings.senderName,
    clientName,
    sessionDate,
    message: message || "",
    sessionNumber: report.session.sessionNumber,
  });

  // Send via Mailcub API
  try {
    const mailcubRes = await fetch("https://api.mail.mailcub.com/api/send_email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sh-key": settings.apiKey,
      },
      body: JSON.stringify({
        to,
        from: settings.senderEmail,
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
}

function buildEmailHtml(params: EmailParams): string {
  const { senderName, clientName, sessionDate, message, sessionNumber } = params;

  const messageHtml = message
    ? `<p style="margin:0 0 20px 0;line-height:1.6;color:#333;">${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(senderName)}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.7;">Occupational Therapy Report</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px 0;font-size:15px;color:#333;">
        Dear Parent/Carer,
      </p>
      ${messageHtml}
      <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;color:#555;">
          <strong>Client:</strong> ${escapeHtml(clientName)}<br/>
          <strong>Session ${sessionNumber}:</strong> ${escapeHtml(sessionDate)}
        </p>
      </div>
      <p style="margin:0 0 8px 0;font-size:14px;color:#555;line-height:1.5;">
        Please find the OT session report details above. If you have any questions or would like to discuss the session further, please don&rsquo;t hesitate to get in touch.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0;font-size:12px;color:#999;text-align:center;">
        ${escapeHtml(senderName)} &middot; Occupational Therapy Services
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
    .replace(/&middot;/g, "·")
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
