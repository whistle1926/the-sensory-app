/**
 * Start a passkey sign-in. Returns a challenge for the browser; the answer
 * goes to NextAuth's "passkey" credentials provider, which verifies it.
 *
 * Public by necessity — you aren't signed in yet. Safe because the challenge
 * is single-use, expires in five minutes, and proves nothing on its own.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticationOptions, sweepChallenges } from "@/lib/passkey";

export async function GET(req: NextRequest) {
  void sweepChallenges();
  try {
    return NextResponse.json(await authenticationOptions(req.nextUrl.origin));
  } catch {
    return NextResponse.json({ error: "Couldn't start sign-in." }, { status: 500 });
  }
}
