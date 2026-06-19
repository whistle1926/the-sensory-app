/**
 * AI tidy-pass for a draft report.
 *
 *   POST /api/reports/[reportId]/tidy
 *     body: { content: ReportContent }
 *     200: { content: ReportContent }
 *
 * The OT clicks "Tidy with AI" while editing. We pass the in-flight
 * draft (not the saved copy) to Claude with a tight prompt asking
 * for grammar/tone cleanup only — no clinical changes. The cleaned
 * JSON is returned to the client; the side-by-side review dialog
 * decides whether to apply it. Persistence still happens via the
 * normal PATCH on Save, so nothing is committed until the OT
 * explicitly approves.
 *
 * Staff-only. Cross-tenant guarded. Rate-limited.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { tidyReport } from "@/lib/claude";
import type { ReportContent } from "@/types/report";

// Same as the generate route — a long report can take 60s+ to tidy
// (this call has the largest token budget). Vercel Fluid Compute
// lifts the cap to 300s, so give it headroom rather than risk a 504.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Same protection rationale as generate — Anthropic calls are
  // metered and slow. Three tidies per five minutes per user is
  // plenty (an OT might tidy once or twice per report).
  const blocked = rateLimitOrReject("report.tidy", session.user.id, {
    max: 3,
    windowMs: 5 * 60_000,
  });
  if (blocked) return blocked;

  const { reportId } = await params;

  // Guard cross-tenant access — we don't trust the body to tell us
  // who owns this report; load + check from the DB.
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true },
  });
  if (!report)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessClient(session.user.role, session.user.id, report.client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { content?: ReportContent };
  if (!body.content || typeof body.content !== "object") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  try {
    const tidied = await tidyReport(body.content);
    return NextResponse.json({ content: tidied });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reports/tidy] Claude failure:", err);
    const hint = /api[_ ]?key/i.test(msg)
      ? "Claude API key issue — check Vercel env."
      : /json|parse/i.test(msg)
        ? "Claude returned content we couldn't parse. Try again, or save without tidying."
        : /timeout|aborted/i.test(msg)
          ? "Claude took too long. Try again."
          : msg.slice(0, 240);
    return NextResponse.json(
      { error: `Tidy failed: ${hint}` },
      { status: 502 },
    );
  }
}
