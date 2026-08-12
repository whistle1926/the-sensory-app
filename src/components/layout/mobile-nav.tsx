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
  Home,
  HousePlus,
  CalendarDays,
  GraduationCap,
  Menu,
  Lock,
  ListChecks,
  Receipt,
  PoundSterling,
  UserCircle2,
  ClipboardList,
  FileStack,
  Radio,
} from "lucide-react";

interface MobileNavProps {
  role: string;
  /** nav_ keys the user's template allows. null = show all (no template). */
  allowedNavKeys: string[] | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, navKey: "nav_dashboard", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/clients", label: "Clients", icon: Users, navKey: "nav_clients", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/website-users", label: "Parents / Carers", icon: UserCircle2, navKey: "nav_website_users", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/reports", label: "Reports", icon: FileText, navKey: "nav_reports", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/home-programmes", label: "Home Programmes", icon: HousePlus, navKey: "nav_home_programmes", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/activities", label: "Activities", icon: BookOpen, navKey: "nav_activities", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/programmes", label: "Programmes", icon: Home, navKey: "nav_programmes", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/bookings", label: "Bookings", icon: CalendarDays, navKey: "nav_bookings", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, navKey: "nav_calendar", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/training", label: "Courses", icon: GraduationCap, navKey: "nav_training", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/tasks", label: "Tasks", icon: ListChecks, navKey: "nav_tasks", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/invoices", label: "Invoices", icon: Receipt, navKey: "nav_invoices", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/services", label: "Price list", icon: PoundSterling, navKey: "nav_services", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/forms", label: "Forms", icon: ClipboardList, navKey: "nav_forms", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/leaflets", label: "Leaflets", icon: FileStack, navKey: "nav_leaflets", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/live-sessions", label: "Live Sessions", icon: Radio, navKey: "nav_live_sessions", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/team", label: "Team", icon: UserPlus, navKey: "nav_team", roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, navKey: "nav_settings", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
];

export function MobileNav({ role, allowedNavKeys }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const filteredItems = navItems.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (allowedNavKeys !== null && !allowedNavKeys.includes(item.navKey)) return false;
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0 border-0">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
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
                    ? "bg-sidebar-primary text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
          {role === "SUPER_ADMIN" && (
            <Link
              href="/private"
              onClick={() => setOpen(false)}
              className={cn(
                "mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                pathname.startsWith("/private")
                  ? "bg-sidebar-primary text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Lock className="h-5 w-5 shrink-0" />
              Private
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
