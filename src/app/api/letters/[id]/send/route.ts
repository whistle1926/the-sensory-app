import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatSender } from "@/lib/email";
import { letterEmailHtml, htmlToText } from "@/lib/letter";

/**
 * Email a letter (to a school, panel, or parent) via Mailcub — the same
 * provider the report-summary and home-programme emails use. On success the
 * letter is marked "sent" (sentAt / sentTo) so the list reflects it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { to, subject, message, isHtml } = await req.json().catch(() => ({}));

  if (!to || !subject)
    return NextResponse.json(
      { error: "Missing recipient or subject" },
      { status: 400 },
    );
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to))
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings?.enabled || !settings.apiKey || !settings.senderEmail) {
    return NextResponse.json(
      { error: "Email is not configured. Please set up Mailcub in Settings." },
      { status: 400 },
    );
  }

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  if (!letter)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientName = letter.client
    ? `${letter.client.firstName} ${letter.client.lastName}`
    : "—";
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = letterEmailHtml({
    senderName: settings.senderName,
    title: letter.title,
    body: letter.body,
    recipient: letter.recipient,
    clientName,
    therapistName: settings.senderName,
    dateLabel,
    message: message || "",
    isHtml: !!isHtml,
  });

  try {
    const res = await fetch("https://api.mail.mailcub.com/api/send_email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sh-key": settings.apiKey },
      body: JSON.stringify({
        receiver: to,
        email_from: formatSender(settings.senderName, settings.senderEmail),
        subject,
        html,
        text: htmlToText(html),
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Mailcub API error:", res.status, errText);
      return NextResponse.json(
        { error: `Email provider error: ${res.status}` },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("Mailcub send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  await prisma.letter.update({
    where: { id },
    data: { status: "sent", sentAt: new Date(), sentTo: to },
  });

  return NextResponse.json({ success: true, sentTo: to });
}
