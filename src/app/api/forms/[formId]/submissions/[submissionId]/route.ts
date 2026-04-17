import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

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
      form: { select: { id: true, title: true, slug: true } },
      invite: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!submission || submission.formId !== formId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(submission);
}

export async function DELETE(
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
    select: { formId: true },
  });
  if (!submission || submission.formId !== formId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.formSubmission.delete({ where: { id: submissionId } });
  return NextResponse.json({ ok: true });
}
