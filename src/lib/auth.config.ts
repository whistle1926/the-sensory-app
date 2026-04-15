import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Routes that never require auth (prefix match)
const PUBLIC_PREFIXES = [
  "/book",
  "/api/bookings",
  "/api/webhooks",
  "/api/availability",
  "/set-password",
  "/api/auth/set-password",
  "/impersonate",
];

// Admin-only app routes (prefix match). CLIENT users get bounced to /portal.
const ADMIN_PREFIXES = [
  "/dashboard",
  "/clients",
  "/reports",
  "/bookings",
  "/activities",
  "/team",
  "/training",
  "/programmes",
  "/settings",
  "/private",
];

// SUPER_ADMIN-only prefixes. TEAM_MANAGER is also bounced out of these.
const SUPER_ADMIN_PREFIXES = ["/private", "/api/private"];

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
        const impersonatedBy = (user as { impersonatedBy?: string | null }).impersonatedBy;
        token.impersonatedBy = impersonatedBy ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT";
      session.user.impersonatedBy = (token.impersonatedBy as string | null | undefined) ?? null;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role as "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT" | undefined;

      const isLoginPage = pathname === "/login" || pathname === "/admin/login";
      const isApiAuth = pathname.startsWith("/api/auth");
      const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
      const isPortal = pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal");
      const isAdminArea = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

      if (isApiAuth || isPublic) return true;

      // Not logged in: allow login pages through; everything else bounces to /login
      if (!isLoggedIn) {
        if (isLoginPage) return true;
        return false;
      }

      // Logged in, sitting on a login page → redirect by role
      if (isLoginPage) {
        const target = role === "CLIENT" ? "/portal" : "/dashboard";
        return Response.redirect(new URL(target, nextUrl));
      }

      // Role-based area gating
      if (role === "CLIENT" && isAdminArea) {
        return Response.redirect(new URL("/portal", nextUrl));
      }
      if ((role === "SUPER_ADMIN" || role === "TEAM_MANAGER") && isPortal) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // SUPER_ADMIN-only gates (private area)
      const isSuperAdminArea = SUPER_ADMIN_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      if (isSuperAdminArea && role !== "SUPER_ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
};
