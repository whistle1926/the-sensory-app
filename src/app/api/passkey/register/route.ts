/**
 * Register a passkey for the signed-in user.
 * GET  → options for the browser to create a key
 * POST → verify what the browser produced and store the public half
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { registrationOptions, verifyRegistration, sweepChallenges } from "@/lib/passkey";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  void sweepChallenges();
  try {
    return NextResponse.json(
      await registrationOptions(session.user.id, req.nextUrl.origin),
    );
  } catch {
    return NextResponse.json({ error: "Couldn't start that." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    label?: string;
  };
  if (!body.response) return NextResponse.json({ error: "Missing response" }, { status: 400 });
  const result = await verifyRegistration(session.user.id, body.response, body.label);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
