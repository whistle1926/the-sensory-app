"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AccountMenu } from "@/components/account/account-menu";
import { cn } from "@/lib/utils";

/**
 * Shared public header used on the landing page, courses storefront,
 * course detail, and booking page. Keeps navigation consistent across
 * every public surface — one set of links, one logo target, one
 * logged-in state handler.
 *
 * When signed in, the Sign-in chip is replaced with the AccountMenu so
 * staff and clients can reach their proper home from any public page.
 */
export function StorefrontHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const signedIn = !!session?.user;

  const links: { href: string; label: string; match: (p: string) => boolean }[] = [
    { href: "/", label: "Home", match: (p) => p === "/" },
    { href: "/courses", label: "Courses", match: (p) => p.startsWith("/courses") },
    { href: "/book", label: "Book a session", match: (p) => p.startsWith("/book") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3">
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

        <nav className="flex items-center gap-1 text-sm font-medium">
          {links.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground",
                  // On narrow viewports: always show Home + Courses; Book a
                  // session tucks away behind a breakpoint.
                  l.href === "/book" ? "hidden md:inline-flex" : "",
                )}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
          <div className="ml-2 flex items-center gap-2">
            {signedIn ? (
              <AccountMenu />
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="hidden items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 sm:inline-flex"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
