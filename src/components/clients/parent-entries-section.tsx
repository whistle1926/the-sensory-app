"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircleQuestion, Sparkles } from "lucide-react";

interface Entry {
  id: string;
  kind: string;
  body: string;
  createdAt: string;
  seenAt: string | null;
  author: { name: string };
}

/**
 * What the parent has written between sessions, shown beside Progress Notes.
 *
 * Nothing emails the therapist when a parent posts — by design, for the first
 * version — so this needs to be visible enough that opening the record before
 * a session is enough to catch it. Unread items are called out at the top.
 */
export function ParentEntriesSection({ clientId }: { clientId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/entries`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((j: { entries?: Entry[] }) => setEntries(j.entries ?? []))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function markRead() {
    await fetch(`/api/clients/${clientId}/entries`, { method: "POST" }).catch(() => {});
    setEntries((prev) =>
      prev.map((e) => (e.seenAt ? e : { ...e, seenAt: new Date().toISOString() })),
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  if (entries.length === 0) return null;

  const unread = entries.filter((e) => !e.seenAt).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          From the parent{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({entries.length})
          </span>
        </h2>
        {unread > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {unread} new
            </span>
            <button
              type="button"
              onClick={markRead}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Mark as read
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Wins and questions the parent added in their portal between sessions.
      </p>

      <ul className="mt-4 space-y-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className={`rounded-xl border p-3 ${
              e.seenAt ? "border-border bg-background" : "border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20"
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold">
              {e.kind === "question" ? (
                <>
                  <MessageCircleQuestion className="h-3.5 w-3.5 text-primary" />
                  Question
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Win
                </>
              )}
              <span className="font-normal text-muted-foreground">
                · {e.author.name} ·{" "}
                {new Date(e.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{e.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
