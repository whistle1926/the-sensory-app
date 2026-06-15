import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { sendMail, buildPasswordSetupEmail } from "./mailer";

interface EnsureStaffResult {
  userId: string;
  /** True when a brand-new account was created this call. */
  created: boolean;
  /** True when the "set your password" email went out. */
  emailSent: boolean;
  /** Set when the email already belongs to a parent/client account. */
  conflict?: "client";
}

/**
 * Find or create a staff (TEAM_MANAGER) account for a therapist by
 * email — the self-serve path behind the "Add a new therapist" control
 * in the booking-service editor. Mirrors ensureParentAccount, but mints
 * a staff role and sends a staff-flavoured setup email.
 *
 * - Existing STAFF account → reuse it (created:false).
 * - Existing CLIENT (parent) account → refuse, returning conflict:"client"
 *   so the caller can explain rather than silently turning a parent into
 *   a therapist.
 * - No account → create TEAM_MANAGER with a random password, a 7-day
 *   PasswordSetupToken, and a best-effort setup email so they choose
 *   their own password.
 */
export async function ensureStaffAccount(params: {
  email: string;
  name: string;
  origin: string;
}): Promise<EnsureStaffResult> {
  const email = params.email.toLowerCase().trim();
  const name = params.name?.trim() || email;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "CLIENT") {
      return { userId: existing.id, created: false, emailSent: false, conflict: "client" };
    }
    return { userId: existing.id, created: false, emailSent: false };
  }

  const randomHash = await bcrypt.hash(
    crypto.randomUUID() + crypto.randomUUID(),
    10,
  );
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: randomHash,
      role: "TEAM_MANAGER",
    },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.passwordSetupToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const setupUrl = `${params.origin}/set-password?token=${token}`;
  const emailSent = await sendMail({
    to: email,
    subject: "Set up your therapist login · The Sensory Submarine",
    html: buildPasswordSetupEmail({ clientName: name, setupUrl }),
  });

  return { userId: user.id, created: true, emailSent };
}
