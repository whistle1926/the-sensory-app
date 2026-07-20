"use client";

/**
 * Tasks — CRM-style table view.
 *
 * Replaces the earlier card-based "Build Updates" feedback layout. The
 * table shape mirrors the spreadsheet the user keeps for tracking
 * requests in flight, with the explicit lifecycle dates (logged →
 * first sent for build → latest update) surfaced as columns so it's
 * easy to see at-a-glance what's pending vs in flight vs done.
 *
 * The status column is editable inline — flipping a row to "Sent to
 * Paddy" stamps `firstBuildAt` (if null) and bumps `latestBuildAt` via
 * the existing PATCH endpoint.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Filter,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";

type Status =
  | "todo"
  | "in_progress"
  | "for_review"
  | "done"
  | "deferred";

interface AssigneeShape {
  user: { id: string; name: string; email: string; role: string };
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  firstBuildAt: string | null;
  latestBuildAt: string | null;
  forReviewAt: string | null;
  completedAt: string | null;
  createdBy: { id: string; name: string; email: string } | null;
  assignees: AssigneeShape[];
  _count: { comments: number };
}

type FilterKey =
  | "all"
  | "todo"
  | "in_progress"
  | "for_review"
  | "done"
  | "deferred";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All items" },
  { key: "todo", label: "🔴 New" },
  { key: "in_progress", label: "🟡 In Progress" },
  { key: "for_review", label: "🟣 For Review (Grace)" },
  { key: "done", label: "✅ Completed" },
  { key: "deferred", label: "⚪ Deferred" },
];

/**
 * Visual + semantic metadata for each status.
 *
 *   • dotClass — used inside the status circle on the left of each row.
 *   • pill     — used by the inline-edit dropdown.
 *   • next     — what the circle cycles to on click. Mirrors a typical
 *                workflow:
 *                  new → in_progress → for_review → done → (back to new)
 *                Deferred sits outside the loop — flip via the dropdown.
 */
const STATUS_META: Record<
  Status,
  { label: string; pill: string; dotClass: string; next?: Status }
> = {
  todo: {
    label: "New",
    pill: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    dotClass: "border-red-500 bg-red-500",
    next: "in_progress",
  },
  in_progress: {
    label: "In Progress",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    dotClass: "border-amber-400 bg-amber-100 dark:bg-amber-950/40",
    next: "for_review",
  },
  for_review: {
    label: "For Review (Grace)",
    pill: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    dotClass: "border-violet-500 bg-violet-500",
    next: "done",
  },
  done: {
    label: "Completed",
    pill: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    dotClass: "border-green-500 bg-green-500 text-white",
    next: "todo",
  },
  deferred: {
    label: "Deferred",
    pill: "bg-muted text-muted-foreground",
    dotClass: "border-border bg-muted",
    next: "todo",
  },
};

export default function TasksPage() {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch("/api/tasks");
    const data = (await r.json()) as TaskRow[];
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== "all") list = list.filter((t) => t.status === filter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    const c = {
      total: rows.length,
      todo: 0,
      in_progress: 0,
      for_review: 0,
      done: 0,
      deferred: 0,
    };
    for (const r of rows) {
      if (r.status in c) c[r.status]++;
    }
    return c;
  }, [rows]);

  // Average "time to fix" = logged → sent For Review (forReviewAt), across
  // every task that's been delivered for checking. Deliberately NOT
  // logged → completed: the wait for Grace/Claire to verify isn't a measure
  // of how fast we turn a fix around, so it's excluded.
  const avgFix = useMemo(() => {
    const spans = rows
      .filter((r) => r.forReviewAt)
      .map((r) => new Date(r.forReviewAt!).getTime() - new Date(r.createdAt).getTime())
      .filter((ms) => Number.isFinite(ms) && ms >= 0);
    if (spans.length === 0) return null;
    const mean = spans.reduce((a, b) => a + b, 0) / spans.length;
    return { label: humanMs(mean), count: spans.length };
  }, [rows]);

  async function changeStatus(id: string, status: Status) {
    setBusyId(id);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? Cannot be undone.`)) return;
    setBusyId(id);
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Build Updates</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{counts.total} items</span>
            <span>🔴 {counts.todo} new</span>
            <span>🟡 {counts.in_progress} in progress</span>
            <span>🟣 {counts.for_review} for review</span>
            <span>✅ {counts.done} completed</span>
            {counts.deferred > 0 && <span>⚪ {counts.deferred} deferred</span>}
            {avgFix?.label && (
              <span
                className="font-medium text-foreground"
                title={`Average turnaround from logged to "For Review" across ${avgFix.count} delivered task${avgFix.count === 1 ? "" : "s"}. Excludes time spent waiting to be verified.`}
              >
                ⏱ Avg fix: {avgFix.label}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Filter chip + search + advanced filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
          >
            <Filter className="h-3.5 w-3.5" />
            {FILTERS.find((f) => f.key === filter)?.label ?? "All items"}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-xl border border-border bg-card p-1 shadow-lg">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFilter(f.key);
                      setFilterOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-muted/50",
                      filter === f.key && "bg-muted",
                    )}
                  >
                    <span>{f.label}</span>
                    {filter === f.key && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold">
              No tasks match this filter.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `No results for "${search}".` : "Try a different filter or add a new task."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Requested by</th>
                  <th className="px-4 py-3 font-medium">Text</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Logged</th>
                  <th className="px-4 py-3 font-medium">First build</th>
                  <th className="px-4 py-3 font-medium">Latest build</th>
                  <th className="px-4 py-3 font-medium">Fixed</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    busy={busyId === t.id}
                    onStatusChange={(s) => changeStatus(t.id, s)}
                    onDelete={() => remove(t.id, t.title)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewTaskDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={() => {
          setShowNew(false);
          refresh();
        }}
      />
    </div>
  );
}

function TaskRow({
  task,
  busy,
  onStatusChange,
  onDelete,
}: {
  task: TaskRow;
  busy: boolean;
  onStatusChange: (s: Status) => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[task.status];
  const isDone = task.status === "done";
  const reqName = task.createdBy?.name ?? "—";
  const commentCount = task._count?.comments ?? 0;

  return (
    <tr className="transition hover:bg-muted/20">
      {/* Status circle — click to advance the row one stage:
            New → In Progress → For Review → Completed → New.
          Deferred is set via the dropdown (sits outside the loop). */}
      <td className="px-4 py-3 align-top">
        <button
          type="button"
          disabled={busy}
          onClick={() => meta.next && onStatusChange(meta.next)}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full border-2 transition",
            meta.dotClass,
          )}
          title={
            meta.next
              ? `${meta.label} → click for ${STATUS_META[meta.next].label}`
              : meta.label
          }
        >
          {isDone ? <Check className="h-3 w-3 text-white" /> : null}
        </button>
      </td>

      {/* Name (strikethrough when done) + comment count.
          The whole name cell is a link → /tasks/[id] which has the
          full comment thread + reply form. Status dropdown, circle,
          and delete button below stay independent so they don't fire
          the navigation by accident. */}
      <td className="px-4 py-3 align-top">
        <Link
          href={`/tasks/${task.id}`}
          className="group inline-flex items-center gap-1.5 hover:underline"
        >
          <span
            className={cn(
              "font-medium",
              isDone && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </span>
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <MessageCircle className="h-2.5 w-2.5" /> {commentCount}
            </span>
          )}
        </Link>
      </td>

      {/* Requested by */}
      <td className="px-4 py-3 align-top text-xs">
        <div className="flex items-center gap-1.5">
          <Avatar name={reqName} />
          <span className="truncate">{reqName.split(" ")[0]}</span>
        </div>
      </td>

      {/* Text — short preview only (first sentence-ish, capped). Click
          through to the detail page for the fully-formatted version. */}
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        <Link
          href={`/tasks/${task.id}`}
          className="block max-w-md hover:text-foreground"
        >
          {previewText(task.description) || (
            <span className="italic">No description.</span>
          )}
        </Link>
      </td>

      {/* Due date */}
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {task.dueDate ? formatShortDate(task.dueDate) : "—"}
      </td>

      {/* Status dropdown — inline editable. Grace flips "For Review" →
          "Completed" when she's verified the build. */}
      <td className="px-4 py-3 align-top">
        <select
          value={task.status}
          disabled={busy}
          onChange={(e) => onStatusChange(e.target.value as Status)}
          className={cn(
            "rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/30",
            meta.pill,
          )}
        >
          <option value="todo">🔴 New</option>
          <option value="in_progress">🟡 In Progress</option>
          <option value="for_review">🟣 For Review (Grace)</option>
          <option value="done">✅ Completed</option>
          <option value="deferred">⚪ Deferred</option>
        </select>
      </td>

      {/* Logged / First build / Latest build */}
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {formatShortDate(task.createdAt)}
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {task.firstBuildAt ? formatShortDate(task.firstBuildAt) : "—"}
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {task.latestBuildAt ? formatShortDate(task.latestBuildAt) : "—"}
      </td>

      {/* Fixed — when it was sent For Review + how long the fix took
          (logged → for_review). This is our turnaround, not the wait for
          sign-off. A ✓ marks tasks that have since been fully completed. */}
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {task.forReviewAt ? (
          <div>
            <div>
              {task.completedAt ? "✓ " : ""}
              {formatShortDate(task.forReviewAt)}
            </div>
            {(() => {
              const d = humanDuration(task.createdAt, task.forReviewAt);
              return d ? (
                <div className="text-[10px] font-medium text-green-600 dark:text-green-400">
                  in {d}
                </div>
              ) : null;
            })()}
          </div>
        ) : (
          "—"
        )}
      </td>

      {/* Delete */}
      <td className="px-4 py-3 align-top text-right">
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
          title="Delete task"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </td>
    </tr>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // Stable hue from name so the same person always lands the same colour.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: `oklch(0.55 0.18 ${h})` }}
    >
      {initials || "—"}
    </span>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

/**
 * Human "time to fix" from logged → completed. Coarse buckets keep it
 * scannable: minutes under 90m, hours under 2 days, otherwise whole days.
 * Returns null for missing/negative spans so callers can render a dash.
 */
function humanDuration(fromIso: string, toIso: string): string | null {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 90) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Same buckets as humanDuration but from a raw millisecond span (for averages). */
function humanMs(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 90) return `${mins} min`;
  const hours = ms / 3_600_000;
  if (hours < 48) return `${Math.round(hours)} hrs`;
  const days = ms / 86_400_000;
  return `${days.toFixed(days < 10 ? 1 : 0)} days`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Build a short, scannable preview from a rich-text description. We
 * pull the first paragraph / first sentence, then hard-cap at ~140
 * chars with a trailing ellipsis so the table row never grows tall.
 * Adds nothing if there's nothing to preview.
 */
function previewText(html: string | null | undefined): string {
  if (!html) return "";
  // Convert <li>/<p>/<br> boundaries to "·" / spaces so the preview
  // doesn't smush list items into adjacent words.
  const withBreaks = html
    .replace(/<\/(p|h\d|li|ul|ol|pre|blockquote)>/gi, "$& ")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<br\s*\/?\s*>/gi, " ");
  const flat = stripHtml(withBreaks);
  const MAX = 140;
  if (flat.length <= MAX) return flat;
  // Try to cut at the nearest sentence/space boundary before the cap.
  const slice = flat.slice(0, MAX);
  const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" "));
  return (cut > 60 ? slice.slice(0, cut) : slice).trimEnd() + "…";
}
