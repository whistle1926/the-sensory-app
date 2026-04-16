"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Target,
  CheckCircle2,
  Circle,
  MessageSquare,
  Pencil,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientGoal {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  achieved: boolean;
  reviewNote: string | null;
  parentNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function GoalsSection({
  clientId,
  isAdmin,
}: {
  clientId: string;
  isAdmin: boolean;
}) {
  const [goals, setGoals] = useState<ClientGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Track which review notes are being edited locally
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [parentDrafts, setParentDrafts] = useState<Record<string, string>>({});

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/goals`);
      if (!res.ok) throw new Error("Failed to load goals");
      const data: ClientGoal[] = await res.json();
      setGoals(data);
    } catch {
      setError("Could not load goals. Please try again.");
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  async function handleAdd() {
    if (!addTitle.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDescription.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to add goal");
      setAddOpen(false);
      setAddTitle("");
      setAddDescription("");
      await fetchGoals();
    } catch {
      setError("Could not add goal. Please try again.");
    }
    setAddSaving(false);
  }

  async function handleToggleAchieved(goal: ClientGoal) {
    const newAchieved = !goal.achieved;
    // Optimistic update
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id
          ? {
              ...g,
              achieved: newAchieved,
              reviewedAt: newAchieved ? new Date().toISOString() : null,
            }
          : g
      )
    );
    try {
      const res = await fetch(`/api/clients/${clientId}/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achieved: newAchieved }),
      });
      if (!res.ok) throw new Error("Failed to update goal");
      // Re-fetch to get server-set reviewedAt
      await fetchGoals();
    } catch {
      // Revert on failure
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goal.id
            ? { ...g, achieved: goal.achieved, reviewedAt: goal.reviewedAt }
            : g
        )
      );
    }
  }

  async function handleSaveReviewNote(goalId: string) {
    const value = reviewDrafts[goalId];
    if (value === undefined) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: value || null }),
      });
      if (!res.ok) throw new Error("Failed to save review note");
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, reviewNote: value || null } : g
        )
      );
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });
    } catch {
      setError("Could not save review note.");
    }
  }

  async function handleSaveParentNote(goalId: string) {
    const value = parentDrafts[goalId];
    if (value === undefined) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentNote: value || null }),
      });
      if (!res.ok) throw new Error("Failed to save parent comment");
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, parentNote: value || null } : g
        )
      );
      setParentDrafts((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });
    } catch {
      setError("Could not save parent comment.");
    }
  }

  function confirmDelete(goalId: string) {
    setDeletingId(goalId);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/goals/${deletingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete goal");
      setDeleteConfirmOpen(false);
      setDeletingId(null);
      await fetchGoals();
    } catch {
      setError("Could not delete goal. Please try again.");
    }
    setDeleting(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Goals</h2>
            <p className="text-sm text-muted-foreground">
              {goals.length === 0
                ? "No goals yet"
                : `${goals.filter((g) => g.achieved).length} of ${goals.length} achieved`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
          >
            <Plus className="h-3.5 w-3.5" /> Add Goal
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">
          {error}
        </div>
      )}

      {/* Goal list */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "No goals added yet. Click \"Add Goal\" to get started."
              : "No goals have been set yet."}
          </p>
        ) : (
          goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isAdmin={isAdmin}
              reviewDraft={reviewDrafts[goal.id]}
              parentDraft={parentDrafts[goal.id]}
              onToggleAchieved={() => handleToggleAchieved(goal)}
              onReviewDraftChange={(val) =>
                setReviewDrafts((prev) => ({ ...prev, [goal.id]: val }))
              }
              onReviewDraftSave={() => handleSaveReviewNote(goal.id)}
              onParentDraftChange={(val) =>
                setParentDrafts((prev) => ({ ...prev, [goal.id]: val }))
              }
              onParentDraftSave={() => handleSaveParentNote(goal.id)}
              onDelete={() => confirmDelete(goal.id)}
            />
          ))
        )}
      </div>

      {/* Add Goal Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Title *</Label>
              <Input
                id="goal-title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="e.g. Improve pencil grip"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Optional details about this goal..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!addTitle.trim() || addSaving}
            >
              {addSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this goal? This action cannot be
            undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeletingId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  GoalCard — individual goal row                                            */
/* -------------------------------------------------------------------------- */

function GoalCard({
  goal,
  isAdmin,
  reviewDraft,
  parentDraft,
  onToggleAchieved,
  onReviewDraftChange,
  onReviewDraftSave,
  onParentDraftChange,
  onParentDraftSave,
  onDelete,
}: {
  goal: ClientGoal;
  isAdmin: boolean;
  reviewDraft: string | undefined;
  parentDraft: string | undefined;
  onToggleAchieved: () => void;
  onReviewDraftChange: (val: string) => void;
  onReviewDraftSave: () => void;
  onParentDraftChange: (val: string) => void;
  onParentDraftSave: () => void;
  onDelete: () => void;
}) {
  const reviewValue =
    reviewDraft !== undefined ? reviewDraft : goal.reviewNote ?? "";
  const parentValue =
    parentDraft !== undefined ? parentDraft : goal.parentNote ?? "";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4 transition-colors",
        goal.achieved && "bg-muted/40 opacity-80"
      )}
    >
      {/* Top row: checkbox + title + badge + delete */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={isAdmin ? onToggleAchieved : undefined}
          disabled={!isAdmin}
          className={cn(
            "mt-0.5 flex-shrink-0 transition-colors",
            isAdmin
              ? "cursor-pointer hover:text-primary"
              : "cursor-default"
          )}
          title={
            isAdmin
              ? goal.achieved
                ? "Mark as in progress"
                : "Mark as achieved"
              : undefined
          }
        >
          {goal.achieved ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-sm font-semibold",
                goal.achieved && "line-through text-muted-foreground"
              )}
            >
              {goal.title}
            </span>
            {goal.achieved && (
              <Badge
                variant="default"
                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              >
                <CheckCircle2 className="h-3 w-3" />
                Achieved
              </Badge>
            )}
          </div>

          {goal.achieved && goal.reviewedAt && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Achieved on{" "}
              {new Date(goal.reviewedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}

          {goal.description && (
            <p
              className={cn(
                "mt-1.5 text-sm text-muted-foreground",
                goal.achieved && "line-through"
              )}
            >
              {goal.description}
            </p>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
            title="Delete goal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Review Note (admin-editable) */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Pencil className="h-3 w-3" />
          Review Note
        </div>
        {isAdmin ? (
          <Textarea
            value={reviewValue}
            onChange={(e) => onReviewDraftChange(e.target.value)}
            onBlur={onReviewDraftSave}
            placeholder="Add a review note..."
            rows={2}
            className="text-sm"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {goal.reviewNote || "No review note yet."}
          </p>
        )}
      </div>

      {/* Parent Comment */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          Parent Comment
        </div>
        {!isAdmin ? (
          <Textarea
            value={parentValue}
            onChange={(e) => onParentDraftChange(e.target.value)}
            onBlur={onParentDraftSave}
            placeholder="Add your comment..."
            rows={2}
            className="text-sm"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {goal.parentNote || "No parent comment yet."}
          </p>
        )}
      </div>
    </div>
  );
}
