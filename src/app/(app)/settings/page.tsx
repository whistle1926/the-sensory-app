"use client";

import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();

  const roleLabel = (session?.user?.role || "")
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (l: string) => l.toUpperCase());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="font-medium text-muted-foreground">Name</span>
            <span className="font-medium">{session?.user?.name || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="font-medium text-muted-foreground">Email</span>
            <span className="font-medium">{session?.user?.email || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Role</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              {roleLabel || "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
