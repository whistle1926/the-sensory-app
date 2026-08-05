/**
 * Passkeys — Touch ID, Face ID, Windows Hello or a security key.
 *
 * Why this is the right thing for a system holding children's records: the
 * private key never leaves the device and nothing secret is ever transmitted,
 * so there is no password to guess, no code to overhear, and nothing in our
 * database worth stealing. Passkeys are bound to the site by the browser,
 * which means they cannot be phished — a fake login page simply won't be
 * offered the key.
 *
 * The challenge is generated and stored server-side, single-use and
 * short-lived, so a captured exchange can't be replayed.
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * The site identity a passkey is bound to.
 *
 * This app answers on more than one hostname, and a passkey only works on the
 * exact domain it was created for — so the identity has to come from the
 * request being served, not from a single configured URL. Getting this wrong
 * is silent: the browser simply refuses to offer the key.
 *
 * Generation uses the host actually being visited. Verification accepts any
 * host in the allowlist, so a key made on one domain still verifies when the
 * check happens without request context.
 */
const RP_NAME = "The Sensory Submarine";

/** Hostnames this app legitimately answers on. */
export const ALLOWED_HOSTS = [
  "portal.thesensorysubmarine.com",
  "book.thesensorysubmarine.com",
  "sensory.aiworldexperts.com",
  "localhost",
];

function hostFrom(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\\n$/, "").replace(/^["']|["']$/g, "");
  try {
    return new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`).hostname;
  } catch {
    return null;
  }
}

/** Identity for the request being served. Pass the request origin or Host. */
export function relyingParty(requestOrigin?: string | null): {
  rpID: string;
  origin: string;
  name: string;
} {
  const host =
    hostFrom(requestOrigin) ??
    hostFrom(process.env.AUTH_URL) ??
    hostFrom(process.env.NEXTAUTH_URL) ??
    "portal.thesensorysubmarine.com";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return {
    rpID: host,
    origin: isLocal ? "http://localhost:3000" : `https://${host}`,
    name: RP_NAME,
  };
}

/** Every origin/rpID a passkey could legitimately have been made against. */
function allExpected(): { origins: string[]; rpIDs: string[] } {
  return {
    origins: ALLOWED_HOSTS.map((h) =>
      h === "localhost" ? "http://localhost:3000" : `https://${h}`,
    ),
    rpIDs: ALLOWED_HOSTS,
  };
}

async function storeChallenge(challenge: string, kind: "register" | "login", userId?: string) {
  await prisma.webauthnChallenge.create({
    data: {
      challenge,
      kind,
      userId: userId ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
}

/** Consume a challenge — single use, so an intercepted one is worthless. */
async function takeChallenge(challenge: string, kind: "register" | "login") {
  const row = await prisma.webauthnChallenge.findUnique({ where: { challenge } });
  if (!row || row.kind !== kind || row.expiresAt < new Date()) return null;
  await prisma.webauthnChallenge.delete({ where: { id: row.id } });
  return row;
}

/** Tidy up anything left behind by an abandoned attempt. */
export async function sweepChallenges() {
  await prisma.webauthnChallenge
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}

// ── Registering a new passkey ────────────────────────────────────────

export async function registrationOptions(userId: string, requestOrigin?: string | null) {
  const { rpID, name } = relyingParty(requestOrigin);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, passkeys: true },
  });
  if (!user) throw new Error("User not found");

  const options = await generateRegistrationOptions({
    rpName: name,
    rpID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    // Don't offer to register a key this account already has.
    excludeCredentials: user.passkeys.map((p) => ({
      id: Buffer.from(p.credentialId, "base64url"),
      type: "public-key" as const,
      transports: p.transports as never,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await storeChallenge(options.challenge, "register", userId);
  return options;
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  label?: string,
) {
  const { origins, rpIDs } = allExpected();
  const stored = await takeChallenge(
    typeof response.response?.clientDataJSON === "string"
      ? JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString()).challenge
      : "",
    "register",
  );
  if (!stored || stored.userId !== userId) {
    return { ok: false as const, error: "That request has expired — try again." };
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origins,
    expectedRPID: rpIDs,
  });
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false as const, error: "Couldn't register that passkey." };
  }

  const info = verification.registrationInfo;
  await prisma.passkey.create({
    data: {
      userId,
      credentialId: Buffer.from(info.credentialID).toString("base64url"),
      publicKey: Buffer.from(info.credentialPublicKey),
      counter: BigInt(info.counter),
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      transports: (response.response.transports ?? []) as string[],
      label: label?.slice(0, 80) || null,
    },
  });
  return { ok: true as const };
}

// ── Signing in with a passkey ────────────────────────────────────────

export async function authenticationOptions(requestOrigin?: string | null) {
  const { rpID } = relyingParty(requestOrigin);
  // No allowCredentials: the browser offers whichever passkey matches this
  // site, so the user doesn't have to type an email first.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await storeChallenge(options.challenge, "login");
  return options;
}

export async function verifyAuthentication(response: AuthenticationResponseJSON) {
  const { origins, rpIDs } = allExpected();
  let challenge = "";
  try {
    challenge = JSON.parse(
      Buffer.from(response.response.clientDataJSON, "base64url").toString(),
    ).challenge;
  } catch {
    return { ok: false as const };
  }

  const stored = await takeChallenge(challenge, "login");
  if (!stored) return { ok: false as const };

  const credentialId = response.id;
  const passkey = await prisma.passkey.findUnique({ where: { credentialId } });
  if (!passkey) return { ok: false as const };

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origins,
    expectedRPID: rpIDs,
    authenticator: {
      credentialID: Buffer.from(passkey.credentialId, "base64url"),
      credentialPublicKey: Buffer.from(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports as never,
    },
  });
  if (!verification.verified) return { ok: false as const };

  // A counter that goes backwards suggests a cloned authenticator.
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return { ok: true as const, userId: passkey.userId };
}
