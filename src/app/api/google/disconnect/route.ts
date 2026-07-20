/**
 * Disconnect the signed-in staff member's Google Calendar write sync.
 * Revokes the refresh token at Google (best-effort) and clears the stored
 * credentials. Existing events already written to their calendar are left
 * in place. Staff-only.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeToken } from "@/lib/google-calendar";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { googleRefreshToken: true },
  });
  if (user?.googleRefreshToken) {
    await revokeToken(user.googleRefreshToken);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      googleRefreshToken: null,
      googleTokenEmail: null,
      googleCalendarId: null,
      googleConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
