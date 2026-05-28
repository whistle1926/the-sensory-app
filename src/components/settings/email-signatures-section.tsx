"use client";

/**
 * Settings → Profile → Signatures.
 *
 * Lets a user maintain up to 6 named signatures. The summary
 * email dialog reads from this list — picking a label there
 * appends the corresponding body to the outbound email.
 *
 * UX: inline list with add/edit/delete. Save persists the whole
 * list atomically (matches the PUT shape on the server). Smaller
 * volume of data means we don't bother with optimistic updates;
 * a single round-trip per Save is plenty fast.
 */
import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Signature, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Sig {
  id: string;
  label: string;
  body: string;
}

function makeBlank(): Sig {
  return {
    id: typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `sig-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: "",
    body: "",
  };
}

const MAX = 6;

export function EmailSignaturesSection() {
  const [list, setList] = useState<Sig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/signatures")
      .then((r) => r.json())
      .then((data: { signatures: Sig[] }) => {
        setList(Array.isArray(data.signatures) ? data.signatures : []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  function update(id: string, patch: Partial<Sig>) {
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function remove(id: string) {
    setList((prev) => prev.filter((s) => s.id !== id));
  }
  function add() {
    if (list.length >= MAX) return;
    setList((prev) => [...prev, makeBlank()]);
  }

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      // Drop entirely-empty rows on the way out so the user can
      // leave half-typed blanks without them counting against MAX.
      const clean = list
        .map((s) => ({ ...s, label: s.label.trim(), body: s.body.trim() }))
        .filter((s) => s.label && s.body);
      const res = await fetch("/api/settings/signatures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatures: clean }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      const { signatures } = (await res.json()) as { signatures: Sig[] };
      setList(signatures);
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
          <Signature className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Email signatures</h2>
          <p className="text-xs text-muted-foreground">
            Save up to {MAX} signatures. Pick one each time you send a report
            summary or invoice email.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={list.length >= MAX || saving}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add signature
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No signatures yet. Click <strong>Add signature</strong> to start —
          you might keep a formal one for referrers and a warmer one for
          parents.
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((s, idx) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Signature {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                  disabled={saving}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor={`sig-label-${s.id}`} className="text-xs">
                    Label
                  </Label>
                  <Input
                    id={`sig-label-${s.id}`}
                    value={s.label}
                    onChange={(e) => update(s.id, { label: e.target.value })}
                    placeholder="e.g. Clinical · formal"
                    maxLength={60}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`sig-body-${s.id}`} className="text-xs">
                    Signature body
                  </Label>
                  <Textarea
                    id={`sig-body-${s.id}`}
                    value={s.body}
                    onChange={(e) => update(s.id, { body: e.target.value })}
                    rows={5}
                    placeholder={"Warm regards,\n\nGrace Magennis\nBSc (Hons) Occupational Therapy, HCPC Registered\nThe Sensory Submarine"}
                    maxLength={2000}
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
              Save signatures
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
