"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/**
 * Minimal public header used on /courses and /courses/[slug]. No sidebar —
 * this is a marketing surface, not the admin app shell.
 */
export function StorefrontHeader() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const signedIn = !!session?.user;

  const portalHref =
    role === "SUPER_ADMIN" || role === "TEAM_MANAGER" ? "/dashboard" : "/portal";

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/courses" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
              <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
              <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
              <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">
            The Sensory Submarine
          </span>
          <span className="text-lg font-bold tracking-tight sm:hidden">
            The Sensory
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-4 text-sm font-medium">
          <Link
            href="/courses"
            className="hidden rounded-lg px-3 py-1.5 hover:bg-muted sm:inline-flex"
          >
            Courses
          </Link>
          <Link
            href="/book"
            className="hidden rounded-lg px-3 py-1.5 hover:bg-muted md:inline-flex"
          >
            Book a session
          </Link>
          {signedIn ? (
            <Link
              href={portalHref}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
            >
              Go to {role === "CLIENT" ? "portal" : "dashboard"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
