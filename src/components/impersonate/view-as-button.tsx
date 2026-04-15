"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, Loader2 } from "lucide-react";

interface Props {
  targetUserId: string;
  targetLabel?: string;
  className?: string;
}

export function ViewAsButton({ targetUserId, targetLabel, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to start impersonation" }));
        setError(data.error || "Failed to start impersonation");
        setLoading(false);
        return;
      }
      const { token } = await res.json();
      const result = await signIn("impersonate", { token, redirect: false });
      if (result?.error) {
        setError("Could not start impersonation session");
        setLoading(false);
        return;
      }
      // Landing the admin on the portal where the banner will show
      window.location.href = "/portal";
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ||
          "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50"
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5" />
            View as {targetLabel || "parent"}
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
