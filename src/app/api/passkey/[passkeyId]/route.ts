/** List / remove your own passkeys. Never anyone else's. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ passkeyId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { passkeyId } = await params;
  const pk = await prisma.passkey.findUnique({
    where: { id: passkeyId },
    select: { userId: true },
  });
  if (!pk || pk.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.passkey.delete({ where: { id: passkeyId } });
  return NextResponse.json({ ok: true });
}
