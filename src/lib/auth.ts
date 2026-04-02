import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  debug: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("[AUTH] authorize called with email:", credentials?.email);
          if (!credentials?.email || !credentials?.password) {
            console.log("[AUTH] missing credentials");
            return null;
          }

          console.log("[AUTH] querying database for user...");
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });
          console.log("[AUTH] user found:", !!user, user?.email);

          if (!user) {
            console.log("[AUTH] no user found");
            return null;
          }

          console.log("[AUTH] comparing password...");
          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          console.log("[AUTH] password match:", passwordMatch);

          if (!passwordMatch) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("[AUTH] authorize error:", error);
          return null;
        }
      },
    }),
  ],
});
