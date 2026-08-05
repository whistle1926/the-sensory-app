/** The signed-in user's own passkeys. */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.user.id },
    select: { id: true, label: true, deviceType: true, backedUp: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ passkeys });
}
