/**
 * POST /api/booking-automations/[id]/test
 *
 * Sends a sample of the automation to the requesting staff user's email
 * (or to a `to` override in the body). Wrapped in a single top-level
 * try/catch so any pre-handler crash (auth, prisma, JSON parse) returns
 * a JSON error rather than a Vercel platform 502 with no body.
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

// Vercel was returning 502 with no body — meaning the function itself is
// crashing at module-load time. Force the runtime to nodejs (instead of
// edge inference) and bump maxDuration so we know which environment we're
// on if it crashes again.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Probe — if this query string is set we short-circuit so we can confirm
  // the function CAN be invoked at all (separate from any later code path).
  const url = new URL(req.url);
  if (url.searchParams.get("probe") === "1") {
    return NextResponse.json({ ok: true, probe: "alive" });
  }

  let stage = "init";
  try {
    stage = "auth";
    const session = await auth();
    if (!session?.user || !isStaff(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    stage = "params";
    const { id } = await params;

    stage = "body";
    const body = (await req.json().catch(() => ({}))) as { to?: string };

    stage = "prisma-find";
    const automation = await prisma.bookingAutomation.findUnique({
      where: { id },
    });
    if (!automation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    stage = "validate-to";
    const to = (body.to ?? session.user.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: "No recipient email available." },
        { status: 400 },
      );
    }

    stage = "render-vars";
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

    stage = "render-template";
    const subject = `[TEST] ${renderTemplate(automation.subject, vars)}`;
    const html = renderTemplate(automation.bodyHtml, vars);

    stage = "mailcub-send";
    const result = await sendTransactionalEmail({ to, subject, html });

    if (!result.ok) {
      console.error("[automation-test] Mailcub returned an error:", result);
      return NextResponse.json(
        {
          error: result.error ?? `Mailcub send failed (HTTP ${result.statusCode ?? "n/a"})`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, to });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error(`[automation-test] crash at stage=${stage}:`, message, stack);
    return NextResponse.json(
      { error: `Test send crashed at stage='${stage}': ${message}` },
      { status: 500 },
    );
  }
}
