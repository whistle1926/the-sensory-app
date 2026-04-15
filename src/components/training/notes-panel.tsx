"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";

interface Props {
  moduleId: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function NotesPanel({ moduleId }: Props) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/portal/training/notes/${moduleId}`)
      .then((r) => (r.ok ? r.json() : { body: "" }))
      .then((data) => {
        if (cancelled) return;
        const initial = data?.body ?? "";
        setBody(initial);
        latestRef.current = initial;
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const save = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/portal/training/notes/${moduleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: value }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
        setTimeout(() => {
          // only reset to idle if no newer edit is pending
          if (latestRef.current === value) setSaveState("idle");
        }, 1500);
      } catch {
        setSaveState("error");
      }
    },
    [moduleId]
  );

  const handleChange = (next: string) => {
    setBody(next);
    latestRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(next), 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Your notes</h3>
          <p className="text-xs text-muted-foreground">
            Private to you — saves automatically.
          </p>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {saveState === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="h-3 w-3 text-green-600" /> Saved
            </>
          )}
          {saveState === "error" && (
            <span className="text-red-500">Couldn&apos;t save</span>
          )}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        placeholder={
          loading
            ? "Loading your notes…"
            : "Jot down takeaways, questions, or ideas for practice…"
        }
        className="min-h-[220px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40"
      />
    </div>
  );
}
