import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { verifyAuthentication } from "@/lib/passkey";
import { verifyLoginCode } from "@/lib/login-code";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { computeNavAccess } from "./nav-access";

/** How often to re-check a signed-in user's nav entitlement. */
const NAV_REFRESH_MS = 5 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    // Sign in with a code emailed to you — the fallback when a passkey isn't
    // an option. Weaker than a passkey by nature, so the code is hashed,
    // single use, expires in ten minutes and dies after five wrong guesses.
    // See src/lib/login-code.ts.
    Credentials({
      id: "login-code",
      name: "Email code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const code = typeof credentials?.code === "string" ? credentials.code : "";
        if (!email || !code) return null;

        const result = await verifyLoginCode(email, code);
        if (!result.ok) return null;

        const user = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          impersonatedBy: null,
          navAccess: await computeNavAccess(user.dashTemplateId),
        };
      },
    }),
    // Passkey sign-in — Touch ID, Face ID, Windows Hello or a security key.
    // The browser proves possession of a private key that never leaves the
    // device, so nothing secret crosses the wire and there is nothing to
    // phish. Verification (challenge, origin and signature) is in
    // src/lib/passkey.ts.
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: { response: { label: "Passkey", type: "text" } },
      async authorize(credentials) {
        const raw = typeof credentials?.response === "string" ? credentials.response : "";
        if (!raw) return null;
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return null;
        }

        const result = await verifyAuthentication(parsed);
        if (!result.ok) return null;

        const user = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          impersonatedBy: null,
          navAccess: await computeNavAccess(user.dashTemplateId),
        };
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          impersonatedBy: null,
          navAccess: await computeNavAccess(user.dashTemplateId),
        };
      },
    }),
    // Impersonation provider — consumes a short-lived, one-time token
    // created by an admin via /api/admin/impersonate/start (or /end).
    Credentials({
      id: "impersonate",
      name: "impersonate",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const raw = typeof credentials?.token === "string" ? credentials.token : null;
        if (!raw) return null;

        const record = await prisma.impersonationToken.findUnique({
          where: { token: raw },
        });

        if (!record) return null;
        if (record.usedAt) return null;
        if (record.expiresAt < new Date()) return null;

        // Verify the admin was actually SUPER_ADMIN at issue time
        const admin = await prisma.user.findUnique({
          where: { id: record.adminUserId },
        });
        if (!admin || admin.role !== "SUPER_ADMIN") return null;

        const target = await prisma.user.findUnique({
          where: { id: record.targetUserId },
        });
        if (!target) return null;

        // Mark token consumed
        await prisma.impersonationToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });

        return {
          id: target.id,
          name: target.name,
          email: target.email,
          role: target.role,
          // If the token has originalAdminId, this is an *exit* token —
          // clear impersonatedBy. Otherwise, this is an *enter* token —
          // set impersonatedBy to the admin's id so UI can show the banner.
          impersonatedBy: record.originalAdminId ? null : record.adminUserId,
          // Impersonated session sees what the target sees — incl. their
          // restricted access.
          navAccess: await computeNavAccess(target.dashTemplateId),
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,
    /**
     * The edge callback stamps nav access at sign-in and never again, so
     * changing someone's dashboard template did nothing until they happened
     * to log out — which for a non-technical user is indistinguishable from
     * the change not working. This node-side wrapper re-derives it from the
     * database periodically, so a template change lands on its own.
     */
    async jwt(params) {
      const base = await authConfig.callbacks!.jwt!(params);
      const token = (base ?? params.token) as typeof params.token & {
        id?: string;
        nav?: string[] | null;
        navAt?: number;
      };
      const now = Date.now();

      if (params.user) {
        token.navAt = now; // just stamped by the sign-in path
        return token;
      }

      if (token.id && (!token.navAt || now - token.navAt > NAV_REFRESH_MS)) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: token.id },
            select: { dashTemplateId: true },
          });
          if (u) token.nav = await computeNavAccess(u.dashTemplateId);
          token.navAt = now;
        } catch {
          // Keep whatever we already had rather than locking someone out.
        }
      }
      return token;
    },
  },
});
