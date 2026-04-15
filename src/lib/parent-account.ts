import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { sendMail, buildPasswordSetupEmail } from "./mailer";

interface EnsureParentResult {
  userId: string;
  created: boolean;
  emailSent: boolean;
}

/**
 * Find or create a CLIENT-role User for the given parent email.
 *
 * - If a User with this email exists: return its id. If it's a CLIENT, fine.
 *   If it's an admin role, we won't treat it as a parent account and return
 *   created: false with userId = existing id (caller can decide what to do).
 * - If no User exists: create one with role CLIENT, a random password, a
 *   7-day PasswordSetupToken, and fire off a best-effort setup email.
 *
 * Returns { userId, created, emailSent }. Never throws — on unexpected DB
 * error, rethrows; on email failure, emailSent is false but creation succeeds.
 */
export async function ensureParentAccount(params: {
  email: string;
  name: string;
  origin: string;
}): Promise<EnsureParentResult> {
  const email = params.email.toLowerCase().trim();
  const name = params.name?.trim() || email;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { userId: existing.id, created: false, emailSent: false };
  }

  const randomHash = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: randomHash,
      role: "CLIENT",
    },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.passwordSetupToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const setupUrl = `${params.origin}/set-password?token=${token}`;
  const emailSent = await sendMail({
    to: email,
    subject: "Set your password · The Sensory Submarine",
    html: buildPasswordSetupEmail({ clientName: name, setupUrl }),
  });

  return { userId: user.id, created: true, emailSent };
}
