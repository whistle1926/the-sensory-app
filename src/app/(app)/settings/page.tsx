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
      <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center justify-between border-b border-[oklch(0.955_0.005_260)] pb-3">
            <span className="font-medium text-[oklch(0.5_0.01_260)]">Name</span>
            <span className="font-medium">{session?.user?.name || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[oklch(0.955_0.005_260)] pb-3">
            <span className="font-medium text-[oklch(0.5_0.01_260)]">Email</span>
            <span className="font-medium">{session?.user?.email || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-[oklch(0.5_0.01_260)]">Role</span>
            <span className="rounded-full bg-[oklch(0.955_0.015_25)] px-3 py-1 text-xs font-semibold text-[oklch(0.637_0.237_25.331)]">
              {roleLabel || "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
