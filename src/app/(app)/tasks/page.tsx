"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, MessageCircle, CheckSquare, Calendar as CalendarIcon, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { DueCalendar } from "@/components/tasks/due-calendar";
import { PriorityBadge, StatusBadge } from "@/components/tasks/priority-badge";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";

type TabKey = "all" | "todo" | "in_progress" | "done";

interface Assignee {
  user: { id: string; name: string; email: string; role: string };
}
interface Subtask {
  id: string;
  title: string;
  done: boolean;
}
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  clientUser: { id: string; name: string; email: string } | null;
  assignees: Assignee[];
  subtasks: Subtask[];
  _count: { comments: number };
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

function avatarHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function formatDueLabel(iso: string): { label: string; overdue: boolean; soon: boolean } {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = diffDays < 0;
  const soon = diffDays >= 0 && diffDays <= 2;
  let label: string;
  if (diffDays === 0) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays === -1) label = "Yesterday";
  else if (diffDays < 0) label = `${Math.abs(diffDays)}d overdue`;
  else label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { label, overdue, soon };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = (await res.json()) as TaskRow[];
      setTasks(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    }),
    [tasks]
  );

  const filtered = useMemo(() => {
    if (tab === "all") return tasks;
    return tasks.filter((t) => t.status === tab);
  }, [tasks, tab]);

  const dueDates = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate && t.status !== "done")
        .map((t) => t.dueDate!) as string[],
    [tasks]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track internal work and collect feedback from clients
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-primary/80"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1 text-sm">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium transition-colors",
                  tab === t.key
                    ? "bg-background text-foreground shadow-[var(--shadow-sm)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[10px]",
                    tab === t.key ? "bg-muted text-foreground" : "bg-transparent"
                  )}
                >
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm)]">
              Loading tasks…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center shadow-[var(--shadow-sm)]">
              <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold">No tasks yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tab === "all"
                  ? "Create your first task to get started."
                  : `No tasks in "${TABS.find((t) => t.key === tab)?.label}".`}
              </p>
              {tab === "all" && (
                <button
                  type="button"
                  onClick={() => setShowNew(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Task
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((task) => {
                const completedSubs = task.subtasks.filter((s) => s.done).length;
                const due = task.dueDate ? formatDueLabel(task.dueDate) : null;
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={cn(
                              "truncate text-sm font-semibold",
                              task.status === "done" && "line-through text-muted-foreground"
                            )}
                          >
                            {task.title}
                          </h3>
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                        {task.description && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {due && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                due.overdue && "font-semibold text-red-600",
                                due.soon && !due.overdue && "font-semibold text-orange-600"
                              )}
                            >
                              <CalendarIcon className="h-3 w-3" />
                              {due.label}
                            </span>
                          )}
                          {task.subtasks.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <CheckSquare className="h-3 w-3" />
                              {completedSubs}/{task.subtasks.length}
                            </span>
                          )}
                          {task._count.comments > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {task._count.comments}
                            </span>
                          )}
                          {task.clientUser && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              <UserCircle2 className="h-3 w-3" />
                              {task.clientUser.name.split(" ")[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex -space-x-2">
                        {task.assignees.slice(0, 3).map((a) => (
                          <span
                            key={a.user.id}
                            title={a.user.name}
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: `hsl(${avatarHue(a.user.id)} 70% 50%)`,
                            }}
                          >
                            {initials(a.user.name)}
                          </span>
                        ))}
                        {task.assignees.length > 3 && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold">
                            +{task.assignees.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <DueCalendar dueDates={dueDates} />
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick stats
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Active</dt>
                <dd className="font-semibold">{counts.todo + counts.in_progress}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">In progress</dt>
                <dd className="font-semibold">{counts.in_progress}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Done</dt>
                <dd className="font-semibold">{counts.done}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Shared with clients</dt>
                <dd className="font-semibold">
                  {tasks.filter((t) => t.clientUser).length}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <NewTaskDialog open={showNew} onOpenChange={setShowNew} onCreated={load} />
    </div>
  );
}
