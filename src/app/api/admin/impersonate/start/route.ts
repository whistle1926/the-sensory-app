import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Start impersonation — SUPER_ADMIN only.
 * Body: { targetUserId: string }
 * Returns: { token, url } — caller should sign in via credentials provider
 * "impersonate" with this token (or navigate to /impersonate/[token]).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Refuse to impersonate while already impersonating — must exit first
  if (session.user.impersonatedBy) {
    return NextResponse.json(
      { error: "Already impersonating. Exit current session first." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Safety: never impersonate another SUPER_ADMIN
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot impersonate another super admin" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.impersonationToken.create({
    data: {
      token,
      adminUserId: session.user.id,
      targetUserId: target.id,
      originalAdminId: null, // this is an enter token
      expiresAt,
    },
  });

  return NextResponse.json({ token });
}
