"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, X, Loader2 } from "lucide-react";

interface Props {
  targetName: string;
}

export function ImpersonationBanner({ targetName }: Props) {
  const [exiting, setExiting] = useState(false);

  async function handleExit() {
    setExiting(true);
    try {
      const res = await fetch("/api/admin/impersonate/end", { method: "POST" });
      if (!res.ok) {
        setExiting(false);
        return;
      }
      const { token } = await res.json();
      const result = await signIn("impersonate", { token, redirect: false });
      if (result?.error) {
        setExiting(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setExiting(false);
    }
  }

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>
          Viewing as <strong>{targetName}</strong>{" "}(admin impersonation)
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/30 disabled:opacity-50"
      >
        {exiting ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Exiting…
          </>
        ) : (
          <>
            <X className="h-3 w-3" />
            Exit
          </>
        )}
      </button>
    </div>
  );
}
