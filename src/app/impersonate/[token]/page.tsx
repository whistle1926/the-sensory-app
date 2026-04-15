"use client";

import { useEffect, useState, use } from "react";
import { signIn } from "next-auth/react";
import { Loader2, AlertCircle } from "lucide-react";

export default function ImpersonateConsumePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      const result = await signIn("impersonate", {
        token,
        redirect: false,
      });
      if (result?.error) {
        setError("This link has expired or is invalid.");
        return;
      }
      // Look at the target role to know where to land.
      // We ask the session endpoint because signIn doesn't return the user.
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;
      if (role === "CLIENT") {
        window.location.href = "/portal";
      } else {
        window.location.href = "/dashboard";
      }
    }
    run();
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-foreground/5"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Switching sessions…</span>
      </div>
    </div>
  );
}
