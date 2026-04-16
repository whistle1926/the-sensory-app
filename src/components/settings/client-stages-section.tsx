"use client";

import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Edit3,
  GripVertical,
  Loader2,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Stage {
  id: string;
  label: string;
  colour: string;
  order: number;
  isDefault: boolean;
}

const PRESET_COLOURS = [
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // grey
  "#14B8A6", // teal
  "#F97316", // orange
];

export function ClientStagesSection() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [label, setLabel] = useState("");
  const [colour, setColour] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/client-stages");
    if (res.ok) setStages(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingStage(null);
    setLabel("");
    setColour("#3B82F6");
    setDialogOpen(true);
  }

  function openEdit(s: Stage) {
    setEditingStage(s);
    setLabel(s.label);
    setColour(s.colour);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    if (editingStage) {
      await fetch(`/api/settings/client-stages/${editingStage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), colour }),
      });
    } else {
      await fetch("/api/settings/client-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), colour }),
      });
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this stage? Clients in it will become uncategorised."))
      return;
    await fetch(`/api/settings/client-stages/${id}`, { method: "DELETE" });
    load();
  }

  async function setDefault(id: string) {
    await fetch(`/api/settings/client-stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  async function moveOrder(stage: Stage, direction: "up" | "down") {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === stage.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx]!;
    await Promise.all([
      fetch(`/api/settings/client-stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: other.order }),
      }),
      fetch(`/api/settings/client-stages/${other.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: stage.order }),
      }),
    ]);
    load();
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <GripVertical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Client Journey Stages</h2>
            <p className="text-sm text-muted-foreground">
              Categorise clients by their journey stage
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
        >
          <Plus className="h-3.5 w-3.5" /> Add Stage
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No stages configured. Add one to get started.
          </p>
        ) : (
          sorted.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: s.colour }}
              />
              <span className="flex-1 text-sm font-medium">{s.label}</span>
              {s.isDefault && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Star className="h-2.5 w-2.5" /> Default
                </span>
              )}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveOrder(s, "up")}
                  disabled={i === 0}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveOrder(s, "down")}
                  disabled={i === sorted.length - 1}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                {!s.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(s.id)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Set as default for new clients"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Edit"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        The default stage (star) is automatically assigned to new clients.
        Reorder stages with the arrows — the order determines the section
        layout on the Clients page.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStage ? "Edit Stage" : "Add Stage"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Label *
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="e.g. Active / Ongoing"
                autoFocus
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Colour
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColour(c)}
                    className={cn(
                      "h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110",
                      colour === c
                        ? "border-foreground ring-2 ring-primary/30"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="-mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!label.trim() || saving}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {editingStage ? "Update" : "Add Stage"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
