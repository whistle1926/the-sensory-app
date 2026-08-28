"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AccountMenu } from "@/components/account/account-menu";

/**
 * The storefront header in the Submarine style — chunky outlines, hard
 * shadows, cream glass.
 *
 * Same behaviour as the older StorefrontHeader it sits alongside: the
 * Courses / Sign in / Create account links obey the admin's Storefront
 * toggles, and a signed-in visitor gets the account menu instead of a
 * sign-in chip. Only the clothes are different.
 */
interface Visibility {
  showCoursesNav: boolean;
  showSignIn: boolean;
  showCreateAccount: boolean;
}

export function SubmarineHeader() {
  const { data: session } = useSession();
  const signedIn = !!session?.user;

  // Optimistic: show everything, then apply the saved preferences. A
  // network blip must never hide a link that should be there.
  const [vis, setVis] = useState<Visibility>({
    showCoursesNav: true,
    showSignIn: true,
    showCreateAccount: true,
  });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/storefront", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Partial<Visibility>) => {
        if (cancelled) return;
        setVis({
          showCoursesNav: data.showCoursesNav ?? true,
          showSignIn: data.showSignIn ?? true,
          showCreateAccount: data.showCreateAccount ?? true,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      className="sticky top-0 z-30 border-b-2 border-[#F2E4CD] backdrop-blur-[10px]"
      style={{ background: "rgba(255,248,236,.86)" }}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3 sm:px-10 sm:py-4">
        <Link href="/" className="flex items-center gap-3">
          {/* The real Sensory Submarine logo, cropped to the character.
              White badge so it sits cleanly on the cream header. */}
          <span className="sub-edge grid h-[46px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark.jpg"
              alt="The Sensory Submarine"
              className="h-full w-full object-contain p-0.5"
            />
          </span>
          <span className="sub-display text-lg tracking-[-.2px] sm:text-[21px]">
            The Sensory Submarine
          </span>
        </Link>

        <nav className="flex items-center gap-2.5">
          {vis.showCoursesNav && (
            <Link
              href="/courses"
              className="hidden rounded-full px-4 py-2.5 text-[15px] font-bold hover:bg-[#F6E8D2] sm:inline-flex"
            >
              Courses
            </Link>
          )}
          {signedIn ? (
            <AccountMenu />
          ) : (
            vis.showSignIn && (
              <Link
                href="/login"
                className="rounded-full px-4 py-2.5 text-[15px] font-bold hover:bg-[#F6E8D2]"
              >
                Sign in
              </Link>
            )
          )}
          <Link
            href="/book"
            className="sub-edge sub-press rounded-full px-5 py-3 text-[15px] font-extrabold text-white"
            style={{ background: "var(--sub-pink)" }}
          >
            Book a session
          </Link>
        </nav>
      </div>
    </header>
  );
}
