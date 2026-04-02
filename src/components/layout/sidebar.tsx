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
  Video,
  GraduationCap,
} from "lucide-react";

interface SidebarProps {
  role: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/reports", label: "Reports", icon: FileText, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/activities", label: "Activities", icon: BookOpen, roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/programmes", label: "Programmes", icon: Home, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/consultations", label: "Consultations", icon: Video, roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/training", label: "Training", icon: GraduationCap, roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/team", label: "Team", icon: UserPlus, roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
];

function LogoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.637_0.237_25.331)]">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
        <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
        <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
        <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
      </svg>
    </div>
  );
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-[oklch(0.17_0.015_280)] text-white">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[oklch(0.637_0.237_25.331)] text-white shadow-lg shadow-[oklch(0.637_0.237_25.331)/20%]"
                  : "text-[oklch(0.65_0.01_260)] hover:bg-white/8 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs font-medium text-[oklch(0.65_0.01_260)]">The Sensory Submarine</p>
          <p className="mt-0.5 text-[11px] text-[oklch(0.5_0.01_260)]">OT Report Platform</p>
        </div>
      </div>
    </aside>
  );
}
