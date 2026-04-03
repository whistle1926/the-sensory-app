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
import { Plus, Mail, Building2, MoreHorizontal } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  business: string | null;
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

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
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
    setUsers([...users, { ...newUser, createdAt: new Date().toISOString(), business: null }]);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} team member{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="CLIENT">Client (Parent)</option>
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
      </div>

      {/* Profile Card Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((user) => {
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
          const roleLabel = user.role
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (l) => l.toUpperCase());

          return (
            <div
              key={user.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
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

      {users.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-muted-foreground">No team members yet. Add your first user above.</p>
        </div>
      )}
    </div>
  );
}
