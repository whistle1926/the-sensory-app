/**
 * Quick sign-in with a 6-digit passcode, on a device you've already used.
 *
 * The model is a banking app's, and the constraint is deliberate: this system
 * holds children's clinical records, and six digits on their own are trivially
 * guessable. So a passcode is never a way in from a new machine — it only
 * unlocks a device that has already completed a full email + password sign-in.
 *
 *   1. Sign in normally. That device gets a random token in an httpOnly cookie
 *      and we store only its HASH, so a database leak can't be replayed.
 *   2. On that device afterwards, the passcode alone signs you in.
 *   3. Five wrong tries and the device stops being trusted — back to the
 *      password, which is rate-limited and long.
 *
 * Trust expires after 30 days so a laptop that's forgotten about doesn't stay
 * a valid entry point indefinitely.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const DEVICE_COOKIE = "ss_device";
export const PASSCODE_LENGTH = 6;
const TRUST_DAYS = 30;
const MAX_TRIES = 5;

/** Only digits, exactly the expected length, and not a single repeated digit
 *  or a straight run — those are the first things anyone would try. */
export function passcodeProblem(code: string): string | null {
  if (!/^\d+$/.test(code)) return "Use numbers only.";
  if (code.length !== PASSCODE_LENGTH)
    return `It needs to be ${PASSCODE_LENGTH} digits.`;
  if (/^(\d)\1+$/.test(code)) return "Don't use the same digit repeated.";
  const asc = "0123456789";
  const desc = "9876543210";
  if (asc.includes(code) || desc.includes(code))
    return "Don't use digits in a run, like 123456.";
  return null;
}

export async function setPasscode(userId: string, code: string): Promise<void> {
  const hash = await bcrypt.hash(code, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passcodeHash: hash, passcodeSetAt: new Date() },
  });
}

export async function clearPasscode(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passcodeHash: null, passcodeSetAt: null },
  });
  // A passcode that's been turned off shouldn't leave trusted devices behind.
  await prisma.trustedDevice.deleteMany({ where: { userId } });
}

/** Cookie value is the raw token; the DB stores its SHA-256. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Remember this browser after a full password sign-in. Returns the raw token
 *  for the caller to put in an httpOnly cookie. */
export async function trustDevice(userId: string, label?: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      label: label?.slice(0, 120) ?? null,
      expiresAt: new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return raw;
}

export interface TrustedDeviceUser {
  id: string;
  name: string;
  email: string;
  hasPasscode: boolean;
}

/** Who does this device belong to — used to greet them on the login screen. */
export async function deviceOwner(rawToken: string | undefined): Promise<TrustedDeviceUser | null> {
  if (!rawToken) return null;
  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, name: true, email: true, passcodeHash: true } } },
  });
  if (!device || device.expiresAt < new Date()) return null;
  return {
    id: device.user.id,
    name: device.user.name,
    email: device.user.email,
    hasPasscode: !!device.user.passcodeHash,
  };
}

export type PasscodeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "no-device" | "no-passcode" | "wrong"; triesLeft?: number };

/**
 * Check a passcode against a trusted device. Wrong attempts are counted on the
 * device; once they run out the device is untrusted entirely, so a guessing
 * attack gets five tries and then faces the full password.
 */
export async function verifyPasscode(
  rawToken: string | undefined,
  code: string,
): Promise<PasscodeResult> {
  if (!rawToken) return { ok: false, reason: "no-device" };
  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, passcodeHash: true } } },
  });
  if (!device || device.expiresAt < new Date()) return { ok: false, reason: "no-device" };
  if (!device.user.passcodeHash) return { ok: false, reason: "no-passcode" };

  const valid = await bcrypt.compare(code, device.user.passcodeHash);
  if (!valid) {
    const tries = device.failedTries + 1;
    if (tries >= MAX_TRIES) {
      await prisma.trustedDevice.delete({ where: { id: device.id } });
      return { ok: false, reason: "wrong", triesLeft: 0 };
    }
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: { failedTries: tries },
    });
    return { ok: false, reason: "wrong", triesLeft: MAX_TRIES - tries };
  }

  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { failedTries: 0, lastUsedAt: new Date() },
  });
  return { ok: true, userId: device.user.id };
}

/** Constant-time compare helper for any future token checks. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
