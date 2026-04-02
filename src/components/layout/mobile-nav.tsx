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
      <SheetTrigger >
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-xl font-bold text-gray-900">The Sensory</span>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
