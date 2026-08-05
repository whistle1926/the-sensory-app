/**
 * Who does this browser belong to?
 *
 * The login page asks this before showing anything: if the device is trusted
 * and its owner has a passcode, it offers the short code instead of the full
 * form. Returns the name and whether a passcode exists — never the email in
 * full, and nothing at all for an unrecognised browser.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEVICE_COOKIE, deviceOwner, trustDevice } from "@/lib/passcode";

export async function GET() {
  const jar = await cookies();
  const owner = await deviceOwner(jar.get(DEVICE_COOKIE)?.value);
  if (!owner || !owner.hasPasscode) return NextResponse.json({ known: false });
  return NextResponse.json({
    known: true,
    name: owner.name,
    // Masked so a shared screen doesn't reveal the full address.
    emailHint: owner.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
  });
}

/**
 * Remember this browser, called straight after a successful password sign-in.
 *
 * Only does anything if the user actually has a passcode — there's no point
 * trusting a device that has no shortcut to unlock. This is what lets the
 * passcode work on a second machine: sign in properly once there, and it
 * becomes available from then on.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ trusted: false });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passcodeHash: true },
  });
  if (!me?.passcodeHash) return NextResponse.json({ trusted: false });

  const jar = await cookies();
  // Already trusted for this same user — nothing to do.
  const existing = await deviceOwner(jar.get(DEVICE_COOKIE)?.value);
  if (existing?.id === session.user.id) return NextResponse.json({ trusted: true });

  const raw = await trustDevice(session.user.id, req.headers.get("user-agent") ?? undefined);
  jar.set(DEVICE_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return NextResponse.json({ trusted: true });
}
