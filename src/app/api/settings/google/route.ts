/**
 * Google Calendar write-sync connection status for the signed-in staff
 * member. Feeds the "2-way sync" card in Settings → Calendar.
 *
 *   configured — are the app's OAuth client credentials present in the env?
 *                 (false → the developer still needs to add them)
 *   connected  — has this user granted access? (has a refresh token)
 *   email      — which Google account is connected
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleOAuthConfigured } from "@/lib/google-calendar";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { googleRefreshToken: true, googleTokenEmail: true, googleConnectedAt: true },
  });
  return NextResponse.json({
    configured: googleOAuthConfigured(),
    connected: Boolean(user?.googleRefreshToken),
    email: user?.googleTokenEmail ?? null,
    connectedAt: user?.googleConnectedAt ?? null,
  });
}
