"use client";

import { useState } from "react";
import { Check, Clock, Loader2 } from "lucide-react";

/** The two answers, posted rather than linked — see src/lib/task-triage.ts. */
export function TriageButtons({
  taskId,
  userId,
  token,
}: {
  taskId: string;
  userId: string;
  token: string;
}) {
  const [busy, setBusy] = useState<"action" | "park" | null>(null);
  const [done, setDone] = useState<"action" | "park" | null>(null);
  const [error, setError] = useState("");

  async function send(action: "action" | "park") {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId, token, action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Couldn't save that. Try again.");
        return;
      }
      setDone(action);
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="mt-5 rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-2 font-bold">
          <Check className="h-4 w-4 text-primary" />
          {done === "action" ? "Marked for action" : "Parked"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {done === "action"
            ? "It's moved to In progress and is first in the queue."
            : "It'll sit where it is until you look. Nobody's waiting on it."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      <button
        type="button"
        onClick={() => send("action")}
        disabled={!!busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy === "action" && <Loader2 className="h-4 w-4 animate-spin" />}
        Get this actioned
      </button>
      <button
        type="button"
        onClick={() => send("park")}
        disabled={!!busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:bg-muted disabled:opacity-50"
      >
        {busy === "park" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
        Park until I look
      </button>
      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
