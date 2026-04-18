"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  // Match when the current path starts with any of these prefixes —
  // lets `/portal/training/[courseId]` keep the Training tab active.
  matchPrefixes: string[];
}

const ITEMS: Item[] = [
  {
    href: "/portal/training",
    label: "Training",
    matchPrefixes: ["/portal/training"],
  },
  {
    href: "/portal/bookings",
    label: "My Bookings",
    matchPrefixes: ["/portal/bookings"],
  },
  {
    href: "/book",
    label: "Book a session",
    matchPrefixes: ["/book"],
  },
];

/**
 * Portal header nav — client component so it can read the current path
 * and highlight the active tab. Visual language matches the admin's
 * segmented-control tabs (rounded pill, subtle active fill).
 *
 * Training intentionally comes first: for an enrolled parent that's
 * where they spend real time. Bookings second (only relevant if they
 * also do 1:1). "Book a session" last — deliberately the tail of the
 * nav since it's an outbound jump into the public booking flow.
 */
export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const isActive = item.matchPrefixes.some((p) =>
          pathname === p || pathname.startsWith(p + "/"),
        );
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
