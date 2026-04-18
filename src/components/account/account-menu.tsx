"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogOut, User, LayoutDashboard, GraduationCap, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Shared profile avatar + dropdown. Shows initials, opens to the user's name,
 * email, and quick links. Used on:
 *   - /courses storefront (so buyers see they're signed in)
 *   - /portal layout (so clients can reach their profile)
 *
 * The menu items shown depend on role — CLIENTs see portal links, staff
 * see admin links.
 *
 * If the caller is rendering the menu on a light background (e.g. the
 * warm `#FBF8F3` storefront), pass `dark={false}` to keep the avatar
 * blue-on-white instead of inverted.
 */
export function AccountMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const name = user.name || user.email || "You";
  const initials = name
    .split(" ")
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isClient = user.role === "CLIENT";
  const isStaff =
    user.role === "SUPER_ADMIN" || user.role === "TEAM_MANAGER";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-1 ring-primary/20 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Account menu"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="text-xs font-normal text-muted-foreground truncate">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isClient && (
          <>
            <DropdownMenuItem>
              <Link
                href="/portal/profile"
                className="flex w-full items-center gap-2"
              >
                <User className="h-4 w-4" />
                View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link
                href="/portal/bookings"
                className="flex w-full items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                My bookings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link
                href="/portal/training"
                className="flex w-full items-center gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                My courses
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {isStaff && (
          <>
            <DropdownMenuItem>
              <Link
                href="/dashboard"
                className="flex w-full items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link
                href="/settings"
                className="flex w-full items-center gap-2"
              >
                <User className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/logout" className="flex w-full items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
