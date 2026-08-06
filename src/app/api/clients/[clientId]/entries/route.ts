/**
 * What the parent has written about this child — read by the therapist on the
 * client record.
 *
 * Opening this marks everything as seen, so the parent's portal can honestly
 * say "seen by your therapist" and the record can show what's new since last
 * time.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { clientId } = await params;
  const entries = await prisma.parentEntry.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      seenAt: true,
      author: { select: { name: true } },
    },
  });
  return NextResponse.json({ entries });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  // Mark as read. Separate from GET so simply loading the page in the
  // background can't quietly clear the "new" flag before anyone looked.
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { clientId } = await params;
  await prisma.parentEntry.updateMany({
    where: { clientId, seenAt: null },
    data: { seenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
