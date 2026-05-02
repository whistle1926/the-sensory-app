"use client";

/**
 * Terms tab — admin-editable booking T&Cs.
 *
 * Edits go to PUT /api/booking-terms which bumps the saved version. The
 * /book form reads the live config on every load, so changes ship the
 * moment Save lands. Existing Booking rows keep their original
 * `acceptedTermsVersion` so the audit trail remains intact even after
 * the wording changes.
 */
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TermsClause } from "@/lib/booking-terms";

interface TermsState {
  version: string;
  clauses: TermsClause[];
}

export function TermsSection() {
  const [state, setState] = useState<TermsState | null>(null);
  const [original, setOriginal] = useState<TermsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/booking-terms")
      .then((r) => r.json())
      .then((data) => {
        const clauses = Array.isArray(data?.clauses)
          ? (data.clauses as TermsClause[])
          : [];
        const next = { version: data?.version ?? "", clauses };
        setState(next);
        setOriginal(JSON.parse(JSON.stringify(next)));
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Couldn't load terms"),
      );
  }, []);

  const dirty = state && JSON.stringify(state) !== JSON.stringify(original);

  function patchClause(idx: number, patch: Partial<TermsClause>) {
    setState((prev) =>
      prev
        ? {
            ...prev,
            clauses: prev.clauses.map((c, i) =>
              i === idx ? { ...c, ...patch } : c,
            ),
          }
        : prev,
    );
  }

  function addClause() {
    setState((prev) =>
      prev
        ? {
            ...prev,
            clauses: [
              ...prev.clauses,
              {
                id: `clause-${Date.now().toString(36)}`,
                heading: "New clause",
                body: "",
                depositOnly: false,
              },
            ],
          }
        : prev,
    );
  }

  function removeClause(idx: number) {
    setState((prev) =>
      prev
        ? { ...prev, clauses: prev.clauses.filter((_, i) => i !== idx) }
        : prev,
    );
  }

  function moveClause(idx: number, dir: -1 | 1) {
    setState((prev) => {
      if (!prev) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.clauses.length) return prev;
      const clauses = [...prev.clauses];
      [clauses[idx], clauses[target]] = [clauses[target], clauses[idx]];
      return { ...prev, clauses };
    });
  }

  async function save() {
    if (!state) return;
    setSaving(true);
    setError(null);
    try {
      // Auto-bump version to today's ISO date if the admin didn't set one.
      const version =
        state.version && state.version.trim()
          ? state.version
          : new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/booking-terms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, clauses: state.clauses }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      const updated = (await res.json()) as TermsState;
      setState(updated);
      setOriginal(JSON.parse(JSON.stringify(updated)));
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function bumpVersionNow() {
    setState((prev) =>
      prev ? { ...prev, version: new Date().toISOString().slice(0, 10) } : prev,
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Booking Terms &amp; Conditions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These tick boxes appear on the booking form. Edits apply
              immediately to new bookings. Existing bookings keep their
              original version stamp.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Version label
            </label>
            <input
              type="text"
              value={state?.version ?? ""}
              onChange={(e) =>
                setState((prev) =>
                  prev ? { ...prev, version: e.target.value } : prev,
                )
              }
              placeholder="2026-04-29"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Bumped automatically on save if left blank. Used as the audit
              stamp on every booking.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={bumpVersionNow}
            className="rounded-xl"
            type="button"
          >
            Use today&rsquo;s date
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {state === null && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading terms…
        </div>
      )}

      {state?.clauses.map((c, idx) => (
        <ClauseCard
          key={`${c.id}-${idx}`}
          clause={c}
          canMoveUp={idx > 0}
          canMoveDown={idx < state.clauses.length - 1}
          onChange={(patch) => patchClause(idx, patch)}
          onRemove={() => removeClause(idx)}
          onMoveUp={() => moveClause(idx, -1)}
          onMoveDown={() => moveClause(idx, 1)}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={addClause}
          className="rounded-xl"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add clause
        </Button>

        <div className="flex items-center gap-3">
          {savedAt && Date.now() - savedAt < 5000 && !dirty ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          ) : dirty ? (
            <span className="text-xs text-muted-foreground">Unsaved changes.</span>
          ) : null}
          <Button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-xl"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save terms
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClauseCard({
  clause,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  clause: TermsClause;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<TermsClause>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Move up"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Move down"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Heading
            </label>
            <input
              type="text"
              value={clause.heading}
              onChange={(e) => onChange({ heading: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Body
            </label>
            <textarea
              value={clause.body}
              onChange={(e) => onChange({ body: e.target.value })}
              rows={5}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(clause.depositOnly)}
              onChange={(e) => onChange({ depositOnly: e.target.checked })}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-muted-foreground">
              Only show this clause for services that require a deposit (e.g.
              the Initial OT Consultation)
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          title="Delete clause"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
