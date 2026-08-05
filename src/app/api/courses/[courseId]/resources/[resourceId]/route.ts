/** Remove a course handout. The blob itself is left in storage — cheap, and
 *  it means an accidental delete doesn't destroy the only copy of a file. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; resourceId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { courseId, resourceId } = await params;
  const existing = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    select: { courseId: true },
  });
  if (!existing || existing.courseId !== courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.courseResource.delete({ where: { id: resourceId } });
  return NextResponse.json({ ok: true });
}
