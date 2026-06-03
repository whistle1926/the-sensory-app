import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Routes that never require auth (prefix match)
const PUBLIC_PREFIXES = [
  "/book",
  "/api/bookings",
  // Public read of booking services + terms — the /book form fetches
  // both. The mutating endpoints enforce auth themselves.
  "/api/booking-services",
  "/api/booking-terms",
  "/api/webhooks",
  "/api/availability",
  "/set-password",
  "/api/auth/set-password",
  "/impersonate",
  // Public form fill + submit. The per-form `requireLogin` setting is
  // enforced inside the route itself — the middleware just needs to let
  // the request through.
  "/f/",
  "/api/forms/public/",
  // Public course storefront — `/courses` gallery, `/courses/[slug]` detail,
  // `/courses/thanks` post-checkout. The checkout endpoint supports both
  // signed-in and guest buyers, so it also needs to be public.
  "/courses",
  "/api/courses/public",
  "/api/courses/checkout",
  // Public live-session viewer — anyone with the link can join. The
  // /api/livekit/token route itself decides publish permissions from
  // the room record + signed-in state; admin-only routes stay
  // outside the whitelist so middleware continues to gate them.
  "/live/",
  "/api/livekit/public/",
  "/api/livekit/token",
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
  "/tasks",
  "/programmes",
  "/settings",
  "/invoices",
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

      // Pages where an unauthenticated visitor is expected and we
      // must NOT bounce them to /login. /register is the public
      // self-serve sign-up flow for parents/carers; the two /login
      // pages are the existing parent + staff entry points.
      const isLoginPage =
        pathname === "/login" ||
        pathname === "/admin/login" ||
        pathname === "/register";
      const isApiAuth = pathname.startsWith("/api/auth");
      // Home page is public (marketing landing with course shelf). Signed-in
      // users get a server-side redirect to their actual home — we just need
      // to let the request through the middleware.
      const isHome = pathname === "/";
      const isPublic =
        isHome || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
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
