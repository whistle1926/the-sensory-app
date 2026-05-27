import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "private_unlocked";
const UNLOCK_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

function getPin(): string {
  const pin = process.env.PRIVATE_PIN;
  if (!pin) {
    // In production a missing PIN should refuse to unlock at all
    // (the previous hardcoded "1968" fallback turned this into a
    // 4-digit brute-force in under a minute). Returning an
    // unguessable random value here makes verifyPin() always fail
    // until the env var is set.
    if (process.env.NODE_ENV === "production") {
      return `__unset_${Math.random().toString(36).slice(2)}_${Date.now()}__`;
    }
    return "1968";
  }
  return pin;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Same reasoning as getPin — a hardcoded fallback would let
    // anyone forge the unlock cookie. Throwing at use time (not
    // module load) keeps tests / build steps that don't touch
    // private-pin unaffected.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET must be set in production for private-pin signing",
      );
    }
    return "dev-secret-do-not-use-in-prod";
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function buildToken(expiresAt: number): string {
  const payload = `${expiresAt}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export function verifyPin(input: string): boolean {
  const expected = getPin();
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function setUnlockCookie(): Promise<void> {
  const expiresAt = Date.now() + UNLOCK_WINDOW_MS;
  const token = buildToken(expiresAt);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(UNLOCK_WINDOW_MS / 1000),
  });
}

export async function clearUnlockCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isUnlocked(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}
