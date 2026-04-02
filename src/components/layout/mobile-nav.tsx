"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  FileText,
  UserPlus,
  Settings,
  BookOpen,
  Menu,
} from "lucide-react";

interface MobileNavProps {
  role: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/reports", label: "Reports", icon: FileText, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/activities", label: "Activities", icon: BookOpen, roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/team", label: "Team", icon: UserPlus, roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
];

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-[oklch(0.17_0.015_280)] p-0 border-0">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.637_0.237_25.331)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
              <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
              <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
              <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">The Sensory</span>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[oklch(0.637_0.237_25.331)] text-white"
                    : "text-[oklch(0.65_0.01_260)] hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
