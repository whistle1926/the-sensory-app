/**
 * Sign in with a code emailed to you — the fallback when a passkey isn't
 * available (a borrowed computer, a device without biometrics, a passkey
 * that's been lost with the phone it lived on).
 *
 * The safeguards matter, because a code arriving by email is inherently
 * weaker than a passkey:
 *
 *  - Six digits, hashed in the database, so a leak doesn't hand over logins.
 *  - Ten minutes, then it's dead.
 *  - Single use, and requesting a new one kills the old one.
 *  - Five wrong guesses burns the code entirely.
 *  - Three requests per address per fifteen minutes, so nobody's inbox can be
 *    flooded and nobody can farm codes.
 *  - Requesting a code says the same thing whether or not the address has an
 *    account, so it can't be used to find out who's registered.
 */
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function sixDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type RequestResult =
  | { sent: true }
  | { sent: false; reason: "rate-limited" | "no-account" | "email-failed" };

/**
 * Issue a code and email it. Callers should give the same answer to the user
 * whatever comes back — the distinction is for logging, not for display.
 */
export async function requestLoginCode(rawEmail: string): Promise<RequestResult> {
  const email = rawEmail.trim().toLowerCase();

  const recent = await prisma.loginCode.count({
    where: { email, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= MAX_PER_WINDOW) return { sent: false, reason: "rate-limited" };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  // Still return quietly — the caller must not reveal that this was the reason.
  if (!user) return { sent: false, reason: "no-account" };

  // A new code replaces any outstanding one.
  await prisma.loginCode.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = sixDigits();
  await prisma.loginCode.create({
    data: {
      email,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const firstName = user.name?.split(" ")[0] || "there";
  const res = await sendTransactionalEmail({
    to: email,
    subject: `${code} is your sign-in code`,
    html: brandedEmail({
      bodyHtml: `
        <p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)}</p>
        <p style="margin:0 0 14px;">Here's your code to sign in:</p>
        <p style="margin:0 0 20px;font-size:34px;font-weight:700;letter-spacing:8px;font-family:monospace;">${code}</p>
        <p style="margin:0 0 14px;">It works for the next 10 minutes and can only be used once.</p>
        <p style="margin:0 0 14px;color:#666;">If you didn't ask for this, you can ignore it — nobody can get in without the code, and we'll never ask you for it.</p>
        <p style="margin:0;"><strong>The Sensory Submarine</strong></p>`,
    }),
  });
  if (!res.ok) return { sent: false, reason: "email-failed" };
  return { sent: true };
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "no-code" | "expired" | "wrong" | "used"; triesLeft?: number };

export async function verifyLoginCode(rawEmail: string, code: string): Promise<VerifyResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "wrong" };

  const record = await prisma.loginCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, reason: "no-code" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    const attempts = record.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      // Burn it rather than let a guesser keep going.
      await prisma.loginCode.update({
        where: { id: record.id },
        data: { attempts, usedAt: new Date() },
      });
      return { ok: false, reason: "wrong", triesLeft: 0 };
    }
    await prisma.loginCode.update({ where: { id: record.id }, data: { attempts } });
    return { ok: false, reason: "wrong", triesLeft: MAX_ATTEMPTS - attempts };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: false, reason: "no-code" };

  await prisma.loginCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return { ok: true, userId: user.id };
}

/** Housekeeping — drop anything long dead. */
export async function sweepLoginCodes() {
  await prisma.loginCode
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => {});
}
