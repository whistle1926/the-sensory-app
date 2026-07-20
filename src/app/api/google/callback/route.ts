/**
 * Google OAuth callback. Google redirects here after the staff member
 * grants (or denies) calendar access. We validate the signed `state`,
 * exchange the code for a refresh token, and store it on that user so
 * booking creation can write events to their Google calendar.
 *
 * Security: the user this connects is taken from the HMAC-signed `state`
 * (minted in /api/google/connect), not from the request — so the callback
 * can't be tricked into attaching someone else's Google account. We also
 * cross-check the current session where present.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForTokens,
  verifyOAuthState,
} from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const settings = (status: string) =>
    NextResponse.redirect(new URL(`/settings?tab=calendar&google=${status}`, base));

  const params = req.nextUrl.searchParams;
  const error = params.get("error");
  if (error) {
    // User clicked "Cancel" on the Google consent screen, etc.
    return settings(error === "access_denied" ? "denied" : "error");
  }

  const code = params.get("code");
  const state = params.get("state");
  const userId = verifyOAuthState(state);
  if (!code || !userId) return settings("error");

  // Defence in depth: if there's an active session it must be the same user.
  const session = await auth();
  if (session?.user?.id && session.user.id !== userId) return settings("error");

  const tokens = await exchangeCodeForTokens(code, req.nextUrl.origin);
  if (!tokens) return settings("error");

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleRefreshToken: tokens.refreshToken,
      googleTokenEmail: tokens.email,
      googleCalendarId: "primary",
      googleConnectedAt: new Date(),
    },
  });

  return settings("connected");
}
