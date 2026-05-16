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

type Status = "todo" | "in_progress" | "done";

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
  completedAt: string | null;
  createdBy: { id: string; name: string; email: string } | null;
  assignees: AssigneeShape[];
  _count: { comments: number };
}

type FilterKey = "all" | "open" | "sent" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All items" },
  { key: "open", label: "Logged (not yet sent)" },
  { key: "sent", label: "Sent to Paddy" },
  { key: "done", label: "Completed" },
];

const STATUS_META: Record<
  Status,
  { label: string; pill: string; next?: Status }
> = {
  todo: {
    label: "Logged",
    pill: "bg-muted text-muted-foreground",
    next: "in_progress",
  },
  in_progress: {
    label: "Sent to Paddy",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    next: "done",
  },
  done: {
    label: "Completed",
    pill: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
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
    if (filter === "open") list = list.filter((t) => t.status === "todo");
    else if (filter === "sent")
      list = list.filter((t) => t.status === "in_progress");
    else if (filter === "done") list = list.filter((t) => t.status === "done");

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
    const sent = rows.filter((r) => r.status === "in_progress").length;
    const open = rows.filter((r) => r.status === "todo").length;
    const done = rows.filter((r) => r.status === "done").length;
    return { sent, open, done, total: rows.length };
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
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.total} items · {counts.open} logged · {counts.sent} sent ·{" "}
            {counts.done} completed
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
            <table className="w-full min-w-[1100px] text-sm">
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
      {/* Status circle — click to advance through todo → in_progress → done → todo */}
      <td className="px-4 py-3 align-top">
        <button
          type="button"
          disabled={busy}
          onClick={() => meta.next && onStatusChange(meta.next)}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full border-2 transition",
            isDone
              ? "border-green-500 bg-green-500 text-white"
              : task.status === "in_progress"
                ? "border-amber-400 bg-amber-100 dark:bg-amber-950/40"
                : "border-border bg-card hover:border-primary",
          )}
          title={`Next: ${STATUS_META[meta.next ?? "todo"].label}`}
        >
          {isDone ? <Check className="h-3 w-3" /> : null}
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

      {/* Text — render html-stripped + truncated, also linked through to
          the detail page so clicking the row body opens the comments. */}
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        <Link
          href={`/tasks/${task.id}`}
          className="line-clamp-2 block max-w-md hover:text-foreground"
        >
          {stripHtml(task.description ?? "") || (
            <span className="italic">No description.</span>
          )}
        </Link>
      </td>

      {/* Due date */}
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {task.dueDate ? formatShortDate(task.dueDate) : "—"}
      </td>

      {/* Status dropdown — inline editable */}
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
          <option value="todo">Logged</option>
          <option value="in_progress">Sent to Paddy</option>
          <option value="done">Completed</option>
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
