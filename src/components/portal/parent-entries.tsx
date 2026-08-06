"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircleQuestion, Sparkles, Trash2 } from "lucide-react";

interface Entry {
  id: string;
  kind: string;
  body: string;
  createdAt: string;
  clientId: string;
  seenAt: string | null;
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * "Wins of the week" and "Questions for your OT" — somewhere for a parent to
 * jot things down between sessions, while they're fresh.
 *
 * Deliberately not a chat. Nothing here notifies the therapist; she reads it
 * when she opens the child's record before a session. The copy says so, so a
 * parent never sits waiting on a reply that isn't coming — writing into a
 * void would be worse than not offering it at all.
 */
export function ParentEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [win, setWin] = useState("");
  const [question, setQuestion] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/portal/entries");
      if (r.ok) {
        const j = (await r.json()) as { clients?: ClientOption[]; entries?: Entry[] };
        setClients(j.clients ?? []);
        setEntries(j.entries ?? []);
        if (!clientId && j.clients?.length) setClientId(j.clients[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(kind: "win" | "question", text: string, clear: () => void) {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, body: text, clientId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Couldn't save that.");
      clear();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    setBusy(true);
    try {
      await fetch(`/api/portal/entries/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const wins = entries.filter((e) => e.kind === "win");
  const questions = entries.filter((e) => e.kind === "question");

  return (
    <div className="space-y-4">
      {clients.length > 1 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs font-semibold" htmlFor="who">
            Which child is this about?
          </label>
          <select
            id="who"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Box
          title="Wins of the week"
          blurb="Anything that went well — a new word, a calmer morning, food they tried. Small things count."
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          placeholder="e.g. Put his own shoes on all by himself on Tuesday."
          value={win}
          onChange={setWin}
          onSubmit={() => add("win", win, () => setWin(""))}
          busy={busy}
          entries={wins}
          onDelete={remove}
        />
        <Box
          title="Questions for your OT"
          blurb="Anything you'd like to ask. Your therapist reads these before your next session."
          icon={<MessageCircleQuestion className="h-4 w-4 text-primary" />}
          placeholder="e.g. Should we keep using the weighted blanket at bedtime?"
          value={question}
          onChange={setQuestion}
          onSubmit={() => add("question", question, () => setQuestion(""))}
          busy={busy}
          entries={questions}
          onDelete={remove}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function Box({
  title,
  blurb,
  icon,
  placeholder,
  value,
  onChange,
  onSubmit,
  busy,
  entries,
  onDelete,
}: {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  entries: Entry[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-bold">
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="mt-3 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !value.trim()}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Add
      </button>

      {entries.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {entries.map((e) => (
            <li key={e.id} className="group rounded-xl bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.body}</p>
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  aria-label="Delete this note"
                  className="shrink-0 rounded-lg p-1 text-muted-foreground opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(e.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
                {e.seenAt ? " · seen by your therapist" : " · not read yet"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
