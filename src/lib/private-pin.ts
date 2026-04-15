import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "private_unlocked";
const UNLOCK_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

function getPin(): string {
  return process.env.PRIVATE_PIN || "1968";
}

function getSecret(): string {
  return process.env.AUTH_SECRET || "dev-secret-do-not-use-in-prod";
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
