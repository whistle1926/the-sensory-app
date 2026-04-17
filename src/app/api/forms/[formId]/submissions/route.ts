import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId } = await params;
  const rows = await prisma.formSubmission.findMany({
    where: { formId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      submitterName: true,
      submitterEmail: true,
      submittedAt: true,
      data: true,
      fieldsSnapshot: true,
      invite: {
        select: {
          id: true,
          email: true,
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  return NextResponse.json(rows);
}
