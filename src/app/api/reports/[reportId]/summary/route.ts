/**
 * Generate an AI summary of a report for a chosen audience.
 *
 *   POST /api/reports/[id]/summary
 *     body: { audience: "clinical" | "parent" }
 *     200: { summary: string }
 *
 * Staff-only. Cross-tenant guarded. Rate-limited. The summary is
 * returned to the client; sending happens in the separate
 * email-summary endpoint after the OT has reviewed + edited.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { summariseReport } from "@/lib/claude";
import type { ReportContent } from "@/types/report";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Same protection as the other Claude endpoints — small per-user
  // cap so a runaway loop or compromised cookie can't blow the bill.
  const blocked = rateLimitOrReject("report.summary", session.user.id, {
    max: 6,
    windowMs: 5 * 60_000,
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
    audience?: "clinical" | "parent";
  };
  const audience = body.audience === "parent" ? "parent" : "clinical";

  try {
    const summary = await summariseReport(
      report.content as unknown as ReportContent,
      audience,
    );
    return NextResponse.json({ summary, audience });
  } catch (err) {
    console.error("[reports/summary] Claude failure:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Summary generation failed: ${msg.slice(0, 240)}` },
      { status: 502 },
    );
  }
}
