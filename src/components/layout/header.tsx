"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  userName: string;
  userRole: string;
}

export function Header({ userName, userRole }: HeaderProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const roleLabel = userRole.replace("_", " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <header className="flex h-16 items-center justify-between bg-card px-6">
      <div className="md:hidden text-lg font-bold text-foreground">
        The Sensory
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary sm:inline">
          {roleLabel}
        </span>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" />}>
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Link href="/settings" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
