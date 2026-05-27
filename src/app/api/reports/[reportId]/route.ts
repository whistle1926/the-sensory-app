import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { recordAudit } from "@/lib/audit";
import { updateReportSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { reportId } = await params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true, session: true, author: true },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cross-tenant guard — without this, any logged-in CLIENT or
  // TEAM_MANAGER could fetch *any* report by changing the id in the
  // URL. canAccessClient walks the client's managerId / parentId.
  if (!canAccessClient(session.user.role, session.user.id, report.client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(report);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { reportId } = await params;
  const body = await req.json();
  const parsed = updateReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Cross-tenant guard before mutating — load the existing report's
  // client and confirm the requester is allowed to touch it. Without
  // this a TEAM_MANAGER could overwrite any other manager's report.
  const existing = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessClient(session.user.role, session.user.id, existing.client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.content) updateData.content = parsed.data.content;
  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.reviewDate) updateData.reviewDate = new Date(parsed.data.reviewDate);

  const report = await prisma.report.update({
    where: { id: reportId },
    data: updateData,
  });

  return NextResponse.json(report);
}

/**
 * Hard-delete a report (staff only). Also removes the backing
 * TherapySession — they're 1:1 and a session with no report is
 * an orphan from the user's perspective. Patrick uses this to
 * clean up test runs.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { reportId } = await params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { sessionId: true, client: true, reportDate: true },
  });
  if (!report)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Cross-tenant guard on destructive action.
  if (!canAccessClient(session.user.role, session.user.id, report.client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Order matters — TherapySession is referenced by Report.sessionId,
  // and the relation defaults to RESTRICT. Delete the report first,
  // then the session it pointed at.
  await prisma.report.delete({ where: { id: reportId } });
  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "report.delete",
    targetType: "report",
    targetId: reportId,
    meta: {
      clientId: report.client.id,
      clientName: `${report.client.firstName} ${report.client.lastName}`,
      reportDate: report.reportDate.toISOString(),
    },
    req,
  });
  await prisma.therapySession
    .delete({ where: { id: report.sessionId } })
    .catch((err) => {
      // Session deletion is best-effort — if some other row started
      // referencing it (future feature) we don't want to fail the
      // overall delete that the user already confirmed.
      console.warn("[reports/DELETE] therapy session orphan:", err);
    });

  return NextResponse.json({ ok: true });
}
