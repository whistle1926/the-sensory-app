import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * End impersonation — called while impersonating.
 * Issues a one-time token that signs back in as the original admin.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const adminId = session.user.impersonatedBy;
  if (!adminId) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Original admin unavailable" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.impersonationToken.create({
    data: {
      token,
      adminUserId: admin.id,
      targetUserId: admin.id, // signing back in as admin
      originalAdminId: admin.id, // flag this as an exit token
      expiresAt,
    },
  });

  return NextResponse.json({ token });
}
