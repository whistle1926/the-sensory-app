"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  UserPlus,
  Settings,
  BookOpen,
  Home,
  CalendarDays,
  GraduationCap,
  Lock,
  ListChecks,
  Receipt,
} from "lucide-react";

interface SidebarProps {
  role: string;
  /** nav_ keys the user's template allows. null = show all (no template). */
  allowedNavKeys: string[] | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, navKey: "nav_dashboard", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/clients", label: "Clients", icon: Users, navKey: "nav_clients", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/reports", label: "Reports", icon: FileText, navKey: "nav_reports", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/activities", label: "Activities", icon: BookOpen, navKey: "nav_activities", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/programmes", label: "Programmes", icon: Home, navKey: "nav_programmes", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/bookings", label: "Bookings", icon: CalendarDays, navKey: "nav_bookings", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/training", label: "Training", icon: GraduationCap, navKey: "nav_training", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/tasks", label: "Tasks", icon: ListChecks, navKey: "nav_tasks", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/invoices", label: "Invoices", icon: Receipt, navKey: "nav_invoices", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/team", label: "Team", icon: UserPlus, navKey: "nav_team", roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, navKey: "nav_settings", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
];

function LogoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
        <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
        <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
        <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
      </svg>
    </div>
  );
}

export function Sidebar({ role, allowedNavKeys }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter((item) => {
    // Must have the correct role
    if (!item.roles.includes(role)) return false;
    // If a template is active, must be in the allowed keys
    if (allowedNavKeys !== null && !allowedNavKeys.includes(item.navKey)) return false;
    return true;
  });

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col text-white" style={{ background: "var(--gradient-sidebar)" }}>
      <div className="flex h-16 items-center gap-3 px-5">
        <LogoMark />
        <Link href="/dashboard" className="text-lg font-bold tracking-tight text-white">
          The Sensory
        </Link>
      </div>
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-white shadow-[var(--shadow-glow)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {role === "SUPER_ADMIN" && (
        <div className="px-3 pb-2 pt-4">
          <Link
            href="/private"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              pathname.startsWith("/private")
                ? "bg-sidebar-primary text-white shadow-[var(--shadow-glow)]"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
            )}
          >
            <Lock className="h-5 w-5 shrink-0" />
            Private
          </Link>
        </div>
      )}
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-xs font-medium text-sidebar-foreground">The Sensory Submarine</p>
          <p className="mt-0.5 text-[11px] text-sidebar-foreground/60">OT Report Platform</p>
        </div>
      </div>
    </aside>
  );
}
