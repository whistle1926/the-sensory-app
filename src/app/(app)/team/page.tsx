"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  LayoutDashboard,
  Mail,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Toolbar } from "@/components/ds";

interface DashTemplate {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  business: string | null;
  dashTemplateId: string | null;
  createdAt: string;
}

const roleColour: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-500",
  TEAM_MANAGER: "bg-blue-500",
  CLIENT: "bg-green-500",
};

const businessLabel: Record<string, string> = {
  SENSORY_SUBMARINE: "The Sensory Submarine",
  LITTLE_SENSORY_EXPLORERS: "The Little Sensory Explorers",
  SENSORY_EATERS: "Sensory Eaters Programme",
};

/**
 * Tabbed split between staff (admins + team managers) and the
 * parent / carer / client accounts. Grace asked for these to be
 * separated so the staff view isn't drowned by client accounts
 * once we onboard more families. Same data, same fetch, just two
 * filtered slices behind a tab switch.
 */
type TeamTab = "staff" | "clients";

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<DashTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TeamTab>("staff");
  // The Add-User dialog defaults to the role that matches the
  // currently-active tab so the OT doesn't have to switch the
  // role dropdown after they pick Add User from the Clients tab.
  const [defaultRole, setDefaultRole] = useState<string>("TEAM_MANAGER");

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/settings/dash-templates")
      .then((r) => r.json())
      .then((data: DashTemplate[]) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        business: form.get("business") || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to create user");
      return;
    }

    const newUser = await res.json();
    setUsers([...users, { ...newUser, createdAt: new Date().toISOString(), business: null, dashTemplateId: null }]);
    setOpen(false);
  }

  async function handleTemplateChange(userId: string, templateId: string | null) {
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, dashTemplateId: templateId } : u))
    );
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashTemplateId: templateId }),
      });
    } catch {
      // Revert on failure — refetch
      fetch("/api/users").then((r) => r.json()).then(setUsers);
    }
  }

  const staffUsers = users.filter(
    (u) => u.role === "SUPER_ADMIN" || u.role === "TEAM_MANAGER",
  );
  const clientUsers = users.filter((u) => u.role === "CLIENT");
  const staff = staffUsers.length;
  const clients = clientUsers.length;
  const admins = users.filter((u) => u.role === "SUPER_ADMIN").length;
  const visibleUsers = tab === "staff" ? staffUsers : clientUsers;

  return (
    <div className="space-y-6">
      <Toolbar
        title="Team"
        subtitle={`${users.length} team member${users.length === 1 ? "" : "s"}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  onClick={() => {
                    // Preselect the role that matches whichever tab
                    // we're currently on, so "Add" from Clients
                    // creates a parent and "Add" from Staff creates
                    // a team manager.
                    setDefaultRole(tab === "clients" ? "CLIENT" : "TEAM_MANAGER");
                  }}
                />
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {tab === "clients" ? "Add parent / carer" : "Add team member"}
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue={defaultRole}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="CLIENT">Parent / Carer</option>
                  <option value="TEAM_MANAGER">Team Manager</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business">Business (optional)</Label>
                <select
                  id="business"
                  name="business"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  <option value="SENSORY_SUBMARINE">The Sensory Submarine</option>
                  <option value="LITTLE_SENSORY_EXPLORERS">The Little Sensory Explorers</option>
                  <option value="SENSORY_EATERS">Sensory Eaters Programme</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      {/* KPI row */}
      {users.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total members",
              value: String(users.length),
              helper: `${staff} staff · ${clients} clients`,
              icon: Users,
            },
            {
              label: "Staff",
              value: String(staff),
              helper: "Admins + managers",
              icon: ShieldCheck,
            },
            {
              label: "Admins",
              value: String(admins),
              helper: "Super Admin role",
              icon: LayoutDashboard,
            },
            {
              label: "Clients",
              value: String(clients),
              helper: "Portal accounts",
              icon: Mail,
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="ds-kpi">
                <div className="ds-kpi-head">
                  <span className="ds-kpi-label">{k.label}</span>
                  <span className="ds-kpi-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <span className="ds-kpi-value ds-tabular">{k.value}</span>
                <div className="ds-kpi-foot">
                  <span>{k.helper}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab strip: staff vs parents/carers. Counts are shown
          inline so the OT can see at a glance which slice they're
          looking at and the size of the other slice. */}
      <div className="inline-flex rounded-xl border border-border bg-card p-1 text-sm">
        {(
          [
            { id: "staff", label: "My team", count: staff, helper: "Admins + associates" },
            { id: "clients", label: "Parents / carers", count: clients, helper: "Portal accounts" },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-pressed={active}
              title={t.helper}
            >
              <span className="font-semibold">{t.label}</span>
              <span className="ml-2 tabular-nums opacity-80">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Profile Card Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleUsers.map((user) => {
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
          const roleLabel = user.role
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (l) => l.toUpperCase());
          const isStaff = user.role === "SUPER_ADMIN" || user.role === "TEAM_MANAGER";
          const templateName = templates.find((t) => t.id === user.dashTemplateId)?.name;

          return (
            <div
              key={user.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] card-lift"
            >
              {/* Top row: avatar + menu */}
              <div className="flex items-start justify-between">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/20 bg-muted">
                    <span className="text-lg font-bold text-foreground">{initials}</span>
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${roleColour[user.role] || "bg-muted-foreground"}`}
                  />
                </div>
                <button className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              {/* Name + Role */}
              <div className="mt-4">
                <h3 className="font-semibold text-foreground">{user.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {roleLabel}
                  {user.business && ` at `}
                  {user.business && (
                    <span className="font-medium text-foreground">
                      {businessLabel[user.business] || user.business}
                    </span>
                  )}
                </p>
              </div>

              {/* Contact Info */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.business && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{businessLabel[user.business] || user.business}</span>
                  </div>
                )}
              </div>

              {/* Dashboard Template Assignment — only for staff users */}
              {isStaff && templates.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <LayoutDashboard className="h-3 w-3" />
                    Dashboard
                  </div>
                  <select
                    value={user.dashTemplateId || ""}
                    onChange={(e) =>
                      handleTemplateChange(user.id, e.target.value || null)
                    }
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Default template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {templateName && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Using: {templateName}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <a
                  href={`mailto:${user.email}`}
                  className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                >
                  Message
                </a>
                <button className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                  View Profile
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {visibleUsers.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
          <p className="text-muted-foreground">
            {tab === "staff"
              ? "No team members yet. Click “Add team member” above to invite an admin or associate."
              : "No parent / carer accounts yet. Click “Add parent / carer” above to invite a family."}
          </p>
        </div>
      )}
    </div>
  );
}
