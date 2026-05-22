"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCircle2,
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
  PoundSterling,
  ClipboardList,
  FileStack,
  Radio,
  Pencil,
  Check,
  X,
  GripVertical,
  RotateCcw,
} from "lucide-react";

interface SidebarProps {
  role: string;
  /** nav_ keys the user's template allows. null = show all (no template). */
  allowedNavKeys: string[] | null;
  /** User's preferred order of navKeys. Empty = default order. */
  navOrder: string[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  navKey: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, navKey: "nav_dashboard", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/clients", label: "Clients", icon: Users, navKey: "nav_clients", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/website-users", label: "Website Users", icon: UserCircle2, navKey: "nav_website_users", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/reports", label: "Reports", icon: FileText, navKey: "nav_reports", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/activities", label: "Activities", icon: BookOpen, navKey: "nav_activities", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/programmes", label: "Programmes", icon: Home, navKey: "nav_programmes", roles: ["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"] },
  { href: "/bookings", label: "Bookings", icon: CalendarDays, navKey: "nav_bookings", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/training", label: "Courses", icon: GraduationCap, navKey: "nav_training", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/tasks", label: "Tasks", icon: ListChecks, navKey: "nav_tasks", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/invoices", label: "Invoices", icon: Receipt, navKey: "nav_invoices", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/services", label: "Services", icon: PoundSterling, navKey: "nav_services", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/forms", label: "Forms", icon: ClipboardList, navKey: "nav_forms", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/leaflets", label: "Leaflets", icon: FileStack, navKey: "nav_leaflets", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
  { href: "/live-sessions", label: "Live Sessions", icon: Radio, navKey: "nav_live_sessions", roles: ["SUPER_ADMIN", "TEAM_MANAGER"] },
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

/**
 * Apply a user's preferred order to a list of nav keys.
 * Keys present in `order` come first (in that order); any new keys added to
 * the app since the user last saved follow in their default catalogue order.
 */
function applyOrder(keysInCatalogueOrder: string[], order: string[]): string[] {
  const present = new Set(keysInCatalogueOrder);
  const used = new Set<string>();
  const ordered: string[] = [];
  for (const k of order) {
    if (present.has(k) && !used.has(k)) {
      ordered.push(k);
      used.add(k);
    }
  }
  for (const k of keysInCatalogueOrder) {
    if (!used.has(k)) ordered.push(k);
  }
  return ordered;
}

export function Sidebar({ role, allowedNavKeys, navOrder }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Items the current user is allowed to see, in catalogue (default) order.
  const visibleCatalogue = useMemo(
    () =>
      navItems.filter((item) => {
        if (!item.roles.includes(role)) return false;
        if (allowedNavKeys !== null && !allowedNavKeys.includes(item.navKey))
          return false;
        return true;
      }),
    [role, allowedNavKeys],
  );

  // The displayed order, respecting the user's preference.
  const orderedKeys = useMemo(
    () =>
      applyOrder(
        visibleCatalogue.map((i) => i.navKey),
        navOrder,
      ),
    [visibleCatalogue, navOrder],
  );

  // Edit mode state — drives drag handles and save/cancel buttons.
  const [editing, setEditing] = useState(false);
  const [draftKeys, setDraftKeys] = useState<string[]>(orderedKeys);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const displayKeys = editing ? draftKeys : orderedKeys;

  function enterEdit() {
    setDraftKeys(orderedKeys);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDragIndex(null);
  }

  function resetOrder() {
    setDraftKeys(visibleCatalogue.map((i) => i.navKey));
  }

  async function saveOrder() {
    setSaving(true);
    try {
      await fetch("/api/settings/nav-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: draftKeys }),
      });
      setEditing(false);
      // Refresh the layout so the server-side order reflects the new state
      // on next navigation.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>,
    overIndex: number,
  ) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === overIndex) return;
    setDraftKeys((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(overIndex);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  // Lookup table from navKey to item for rendering.
  const byKey = new Map(navItems.map((i) => [i.navKey, i]));

  const showEditToggle = !editing && visibleCatalogue.length > 1;

  return (
    <aside
      className="hidden md:flex md:w-64 md:flex-col text-white"
      style={{ background: "var(--gradient-sidebar)" }}
    >
      <div className="flex h-16 items-center gap-3 px-5">
        <LogoMark />
        <Link href="/dashboard" className="text-lg font-bold tracking-tight text-white">
          The Sensory
        </Link>
      </div>

      {/* Header row: "Menu" label + edit/save/cancel buttons */}
      <div className="mt-3 flex items-center justify-between px-5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
          {editing ? "Reorder" : "Menu"}
        </span>
        <div className="flex items-center gap-1">
          {showEditToggle && (
            <button
              type="button"
              onClick={enterEdit}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-white"
              aria-label="Reorder sidebar"
              title="Reorder sidebar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={resetOrder}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-white"
                aria-label="Reset to default"
                title="Reset to default"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-white disabled:opacity-50"
                aria-label="Cancel"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={saveOrder}
                disabled={saving}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-primary text-white transition-colors hover:brightness-110 disabled:opacity-50"
                aria-label="Save order"
                title="Save order"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="mt-2 flex-1 min-h-0 space-y-1 overflow-y-auto px-3">
        {displayKeys.map((key, index) => {
          const item = byKey.get(key);
          if (!item) return null;
          const Icon = item.icon;
          const isActive = !editing && pathname.startsWith(item.href);
          const isDragging = editing && dragIndex === index;

          // Row contents — shared between the draggable wrapper and the link.
          const row = (
            <>
              {editing && (
                <GripVertical className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </>
          );

          const rowClass = cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-sidebar-primary text-white shadow-[var(--shadow-glow)]"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
            editing && "cursor-grab bg-sidebar-accent/40 hover:bg-sidebar-accent",
            isDragging && "opacity-50 ring-2 ring-sidebar-primary",
          );

          if (editing) {
            return (
              <div
                key={key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={rowClass}
              >
                {row}
              </div>
            );
          }

          return (
            <Link key={key} href={item.href} className={rowClass}>
              {row}
            </Link>
          );
        })}
      </nav>
      {role === "SUPER_ADMIN" && !editing && (
        <div className="px-3 pb-2 pt-4">
          <Link
            href="/private"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              pathname.startsWith("/private")
                ? "bg-sidebar-primary text-white shadow-[var(--shadow-glow)]"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Lock className="h-5 w-5 shrink-0" />
            Private
          </Link>
        </div>
      )}
      <div className="border-t border-white/15 p-4">
        <div className="rounded-xl bg-sidebar-primary/20 p-3 ring-1 ring-sidebar-primary/40">
          <p className="text-xs font-bold text-white">The Sensory Submarine</p>
          <p className="mt-1 text-[11px] font-medium text-white/85">OT Report Platform</p>
        </div>
      </div>
    </aside>
  );
}
