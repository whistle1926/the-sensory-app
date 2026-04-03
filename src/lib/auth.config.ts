import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This config is used by middleware (edge-compatible, no Prisma)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize is defined in the full auth.ts, not here
      authorize: () => null,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT";
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isPublic = nextUrl.pathname.startsWith("/book") || nextUrl.pathname.startsWith("/api/bookings") || nextUrl.pathname.startsWith("/api/webhooks") || nextUrl.pathname.startsWith("/api/availability");

      if (isApiAuth || isPublic) return true;
      if (!isLoggedIn && !isLoginPage) return false;
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
};
