import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { requiredNavKey } from "./nav-areas";

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
        // Allowed nav keys (from the user's dashboard template). null =
        // no restriction. Stamped at login; refreshed on next login.
        token.nav = (user as { navAccess?: string[] | null }).navAccess ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT";
      session.user.impersonatedBy = (token.impersonatedBy as string | null | undefined) ?? null;
      session.user.nav = (token.nav as string[] | null | undefined) ?? null;
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
      const isApi = pathname.startsWith("/api/");

      if (isApiAuth || isPublic) return true;

      // Not logged in: allow login pages through; everything else bounces
      // to /login — EXCEPT API routes, which enforce their own auth and
      // must keep working for public/guest callers (this preserves the
      // previous behaviour, where middleware didn't run on /api at all).
      if (!isLoggedIn) {
        if (isLoginPage) return true;
        if (isApi) return true;
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
        // Narrow exception: staff may PREVIEW course pages exactly as a
        // learner sees them (/portal/training/*). Used by the "View as a
        // learner" link after publishing a recording — otherwise staff got
        // bounced to /dashboard and couldn't check their own work. This is
        // their own course material with no client data on it, and the
        // underlying /api/courses data is already open to staff. Every
        // other /portal path still redirects.
        const isCoursePreview =
          pathname === "/portal/training" ||
          pathname.startsWith("/portal/training/");
        if (!isCoursePreview) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }

      // SUPER_ADMIN-only gates (private area)
      const isSuperAdminArea = SUPER_ADMIN_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      if (isSuperAdminArea && role !== "SUPER_ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // ── Fine-grained access control (dashboard templates) ──────────
      // A staff user can be restricted to a subset of areas via their
      // dashboard template (e.g. a "Clinic Associate" who should only
      // reach bookings/calendar). SUPER_ADMIN always bypasses. `nav` is
      // null when the user has no restriction (full access) — only an
      // explicit list locks areas down, so existing staff are unaffected.
      if (role !== "SUPER_ADMIN") {
        const nav = (auth?.user as { nav?: string[] | null } | undefined)?.nav;
        if (Array.isArray(nav)) {
          const required = requiredNavKey(pathname);
          if (required && !nav.includes(required)) {
            // API → hard 403 (blocks the data); page → bounce to a page
            // they're allowed to see.
            return isApi
              ? Response.json({ error: "Forbidden" }, { status: 403 })
              : Response.redirect(new URL("/dashboard", nextUrl));
          }
        }
      }

      return true;
    },
  },
};
