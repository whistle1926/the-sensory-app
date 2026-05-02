/**
 * POST /api/booking-automations/[id]/test
 *
 * Sends a sample of the automation to the requesting staff user's email
 * (or to a `to` override in the body). Uses fake-but-realistic variables
 * so the rendered output looks like a real booking. The subject is
 * prefixed with "[TEST]" so it's obvious in the inbox that nothing has
 * actually been booked.
 *
 * Sends synchronously and surfaces the Mailcub error verbatim if the
 * provider rejects it — this is the easiest way for Patrick to debug
 * Mailcub config / sender-domain issues from the UI.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import {
  renderTemplate,
  variablesForBooking,
} from "@/lib/booking-automation";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { to?: string };

  const automation = await prisma.bookingAutomation.findUnique({
    where: { id },
  });
  if (!automation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const to = (body.to ?? session.user.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: "No recipient email available." },
      { status: 400 },
    );
  }

  // Sample variables — chosen to look like a plausible booking. The
  // appointment date is set to two days from now so the formatted date
  // string doesn't read as "today".
  const sampleDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  sampleDate.setUTCHours(0, 0, 0, 0);
  const vars = variablesForBooking({
    clientName: session.user.name || "Sample Client",
    service: "initial-ot",
    date: sampleDate,
    time: "10:30",
    duration: "60 minutes",
    pricePence: 8500,
    depositPence: 10000,
  });

  const result = await sendTransactionalEmail({
    to,
    subject: `[TEST] ${renderTemplate(automation.subject, vars)}`,
    html: renderTemplate(automation.bodyHtml, vars),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Mailcub send failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, to });
}
