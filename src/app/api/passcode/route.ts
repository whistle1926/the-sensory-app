/**
 * Manage your own quick sign-in passcode.
 *
 * GET    — do I have one, and is this device trusted?
 * POST   — set/change it, and trust the device I'm on right now.
 * DELETE — turn it off (also forgets every trusted device).
 *
 * Always scoped to the signed-in user: nobody can set someone else's passcode,
 * including an admin. An admin resetting a password is a support action; a
 * passcode is a personal shortcut and should only ever be chosen by its owner.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEVICE_COOKIE,
  clearPasscode,
  deviceOwner,
  passcodeProblem,
  setPasscode,
  trustDevice,
} from "@/lib/passcode";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passcodeHash: true, _count: { select: { trustedDevices: true } } },
  });
  const jar = await cookies();
  const owner = await deviceOwner(jar.get(DEVICE_COOKIE)?.value);
  return NextResponse.json({
    hasPasscode: !!me?.passcodeHash,
    deviceTrusted: owner?.id === session.user.id,
    trustedDevices: me?._count.trustedDevices ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const problem = passcodeProblem(code);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await setPasscode(session.user.id, code);

  // Trust the browser this was set from — otherwise the passcode would have
  // nothing to unlock and the first use would fail confusingly.
  const raw = await trustDevice(session.user.id, req.headers.get("user-agent") ?? undefined);
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  await clearPasscode(session.user.id);
  const jar = await cookies();
  jar.delete(DEVICE_COOKIE);
  return NextResponse.json({ ok: true });
}
