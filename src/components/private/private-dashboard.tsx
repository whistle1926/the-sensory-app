"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Lock, Trash2, Check, X } from "lucide-react";

interface Entry {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  reference: string | null;
  occurredAt: string;
}

interface Props {
  initialGoal: number;
  initialTotal: number;
  initialEntries: Entry[];
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function sourceLabel(source: string): string {
  switch (source) {
    case "BOOKING":
      return "Booking";
    case "FIREBUDDY":
      return "FireBuddy";
    case "MANUAL":
      return "Manual";
    default:
      return source;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PrivateDashboard({ initialGoal, initialTotal, initialEntries }: Props) {
  const [goal, setGoal] = useState(initialGoal);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(initialGoal));
  const [goalError, setGoalError] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  const [addAmount, setAddAmount] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const total = useMemo(() => entries.reduce((acc, e) => acc + e.amount, 0), [entries]);
  const pct = goal > 0 ? Math.min(100, (total / goal) * 100) : 0;
  const remaining = Math.max(0, goal - total);

  async function saveGoal() {
    setGoalError("");
    const parsed = Number(goalDraft.replace(/[,\s£]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGoalError("Enter a positive amount.");
      return;
    }
    setGoalSaving(true);
    try {
      const res = await fetch("/api/private/goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(parsed) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Couldn't save" }));
        setGoalError(data.error || "Couldn't save");
        setGoalSaving(false);
        return;
      }
      const data = await res.json();
      setGoal(data.incomeGoal);
      setEditingGoal(false);
    } catch {
      setGoalError("Network error.");
    }
    setGoalSaving(false);
  }

  async function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError("");
    const parsed = Number(addAmount.replace(/[,\s£]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAddError("Enter a positive amount.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/private/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(parsed),
          description: addDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Couldn't save" }));
        setAddError(data.error || "Couldn't save");
        setAdding(false);
        return;
      }
      const { entry } = await res.json();
      setEntries((list) => [entry, ...list]);
      setAddAmount("");
      setAddDescription("");
    } catch {
      setAddError("Network error.");
    }
    setAdding(false);
  }

  async function deleteEntry(id: string) {
    if (!confirm("Remove this entry from the total?")) return;
    const prev = entries;
    setEntries((list) => list.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/api/private/entries/${id}`, { method: "DELETE" });
      if (!res.ok) setEntries(prev);
    } catch {
      setEntries(prev);
    }
  }

  async function lock() {
    await fetch("/api/private/lock", { method: "POST" });
    window.location.href = "/dashboard";
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Income progress
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight">{gbp.format(total)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                of{" "}
                {editingGoal ? (
                  <span className="inline-flex items-center gap-1 align-middle">
                    <Input
                      value={goalDraft}
                      onChange={(e) => setGoalDraft(e.target.value)}
                      className="h-8 w-32 text-sm"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveGoal}
                      disabled={goalSaving}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingGoal(false);
                        setGoalDraft(String(goal));
                        setGoalError("");
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGoal(true);
                      setGoalDraft(String(goal));
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
                  >
                    {gbp.format(goal)} <Pencil className="h-3 w-3" />
                  </button>
                )}{" "}
                goal &middot; {gbp.format(remaining)} to go
              </p>
              {goalError && <p className="mt-1 text-xs text-red-600">{goalError}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={lock}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Lock
            </Button>
          </div>

          <div className="space-y-2">
            <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: "var(--gradient-primary)",
                }}
              />
            </div>
            <p className="text-right text-xs font-medium text-muted-foreground">
              {pct.toFixed(1)}% of goal
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add income</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addEntry} className="space-y-4">
            {addError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">
                {addError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (£)</Label>
                <Input
                  id="amount"
                  inputMode="numeric"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="e.g. 500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Note</Label>
                <Input
                  id="description"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="e.g. Little Sensory Explorers — March payout"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={adding} className="w-full sm:w-auto">
                  <Plus className="mr-1.5 h-4 w-4" />
                  {adding ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No income yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {entry.description || sourceLabel(entry.source)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(entry.occurredAt)} &middot; {sourceLabel(entry.source)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{gbp.format(entry.amount)}</span>
                    {entry.source === "MANUAL" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteEntry(entry.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
