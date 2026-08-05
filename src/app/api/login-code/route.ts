/**
 * Ask for a sign-in code by email.
 *
 * Always answers the same way, whether or not the address has an account and
 * whether or not the send worked — otherwise this becomes a way to find out
 * who is registered. Real failures are logged server-side.
 */
import { NextRequest, NextResponse } from "next/server";
import { requestLoginCode, sweepLoginCodes } from "@/lib/login-code";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  void sweepLoginCodes();
  const result = await requestLoginCode(email);
  if (!result.sent && result.reason !== "no-account") {
    console.warn("[login-code] not sent:", result.reason, email);
  }

  // Deliberately identical in every case.
  return NextResponse.json({
    ok: true,
    message: "If that address has an account, the code is on its way.",
  });
}
