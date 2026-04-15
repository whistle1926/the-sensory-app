import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
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
        };
      },
    }),
  ],
});
