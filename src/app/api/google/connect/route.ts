/**
 * Start the Google Calendar OAuth connect flow for the signed-in staff
 * member. Redirects to Google's consent screen; Google sends the user back
 * to /api/google/callback with an authorization code.
 *
 * Staff-only. If the OAuth client isn't configured (env missing) we bounce
 * back to settings with an error rather than sending the user to a broken
 * Google screen.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildConsentUrl,
  googleOAuthConfigured,
  signOAuthState,
} from "@/lib/google-calendar";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin;
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?tab=calendar&google=unconfigured", base),
    );
  }

  const state = signOAuthState(session.user.id);
  return NextResponse.redirect(buildConsentUrl(state, req.nextUrl.origin));
}
