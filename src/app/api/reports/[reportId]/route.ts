import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  _req: NextRequest,
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
    select: { sessionId: true },
  });
  if (!report)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Order matters — TherapySession is referenced by Report.sessionId,
  // and the relation defaults to RESTRICT. Delete the report first,
  // then the session it pointed at.
  await prisma.report.delete({ where: { id: reportId } });
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
