"use client";

/**
 * Settings → Profile → Personal note presets.
 *
 * Same shape as EmailSignaturesSection — up to 10 labelled presets,
 * managed atomically with a single PUT. Used by the report-summary
 * dialog to pre-fill the "Personal note" field with one click,
 * substituting {{clientName}} for the child's first name.
 */
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Preset {
  id: string;
  label: string;
  body: string;
}

function makeBlank(): Preset {
  return {
    id:
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `np-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: "",
    body: "",
  };
}

const MAX = 10;

export function NotePresetsSection() {
  const [list, setList] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/note-presets")
      .then((r) => r.json())
      .then((data: { presets: Preset[] }) =>
        setList(Array.isArray(data.presets) ? data.presets : []),
      )
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  function update(id: string, patch: Partial<Preset>) {
    setList((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    setList((prev) => prev.filter((p) => p.id !== id));
  }
  function add() {
    if (list.length >= MAX) return;
    setList((prev) => [...prev, makeBlank()]);
  }

  /** Seed the list with three sensible starters so the OT has
   *  something usable on day one without typing them out. */
  function seedDefaults() {
    setList((prev) => [
      ...prev,
      {
        id: makeBlank().id,
        label: "Clinical · referrer",
        body: "Hi, hope you're well. Please find below a summary of today's OT session with {{clientName}}. Happy to discuss further if useful.",
      },
      {
        id: makeBlank().id,
        label: "Parent · warm",
        body: "Hi, hope you're well. Just sending across a quick summary of {{clientName}}'s session today — any questions, just give me a shout.",
      },
      {
        id: makeBlank().id,
        label: "School · SENCO",
        body: "Hi, please find below a summary of today's session with {{clientName}}. The home programme should also work well in the classroom — happy to talk through how best to support them.",
      },
    ]);
  }

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const clean = list
        .map((p) => ({ ...p, label: p.label.trim(), body: p.body.trim() }))
        .filter((p) => p.label && p.body);
      const res = await fetch("/api/settings/note-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presets: clean }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      const { presets } = (await res.json()) as { presets: Preset[] };
      setList(presets);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Personal note presets</h2>
          <p className="text-xs text-muted-foreground">
            One-click intros for the report-summary email. Use{" "}
            <code className="rounded bg-muted px-1 font-mono text-foreground">
              {`{{clientName}}`}
            </code>{" "}
            and it&apos;s replaced with the child&apos;s first name when you apply.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {list.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={seedDefaults}
              disabled={saving}
            >
              Use starter set
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            disabled={list.length >= MAX || saving}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add preset
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No presets yet. Click <strong>Use starter set</strong>{" "}for three
          ready-made templates, or <strong>Add preset</strong>{" "}to write your own.
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((p, idx) => (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Preset {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                  disabled={saving}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor={`np-label-${p.id}`} className="text-xs">
                    Label
                  </Label>
                  <Input
                    id={`np-label-${p.id}`}
                    value={p.label}
                    onChange={(e) => update(p.id, { label: e.target.value })}
                    placeholder="e.g. Clinical · referrer"
                    maxLength={60}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`np-body-${p.id}`} className="text-xs">
                    Note body
                  </Label>
                  <Textarea
                    id={`np-body-${p.id}`}
                    value={p.body}
                    onChange={(e) => update(p.id, { body: e.target.value })}
                    rows={3}
                    placeholder="Hi, hope you're well. Please find below a summary of today's OT session with {{clientName}}."
                    maxLength={1000}
                    className="font-sans text-sm leading-relaxed"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save presets
            </>
          )}
        </Button>
        {saved && (
          <span className="text-sm text-green-700 dark:text-green-400">
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}
