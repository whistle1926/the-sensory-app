/**
 * Record that a user has a password they actually know.
 *
 * The course receipt email decides between "Open your course" and a
 * set-password link by asking whether the user has ever USED a
 * password-setup token — a guest checkout creates the account with a
 * placeholder hash, so the hash column alone can't tell. A buyer who chose
 * a password at checkout (or on /register) never goes through a token, so
 * we file a pre-used one for them. Same signal, no new column.
 */
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export async function markPasswordKnown(userId: string): Promise<void> {
  const now = new Date();
  await prisma.passwordSetupToken.create({
    data: {
      userId,
      token: `known-${randomBytes(18).toString("base64url")}`,
      expiresAt: now,
      usedAt: now,
    },
  });
}
