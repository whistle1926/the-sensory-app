"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Calendar as CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/components/tasks/priority-badge";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  createdBy: { id: string; name: string };
  _count: { comments: number };
}

function formatDue(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function FeedbackPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/feedback")
      .then((r) => r.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Items your therapist has shared with you. Open one to leave a comment
          or suggest changes.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center shadow-[var(--shadow-sm)]">
          <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-semibold">Nothing shared yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When your therapist shares a task with you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Open
              </h2>
              <ul className="space-y-2.5">
                {active.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </h2>
              <ul className="space-y-2.5">
                {done.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const due = formatDue(task.dueDate);
  return (
    <li>
      <Link
        href={`/portal/feedback/${task.id}`}
        className="block rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={cn(
                  "text-sm font-semibold",
                  task.status === "done" && "line-through text-muted-foreground"
                )}
              >
                {task.title}
              </h3>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </div>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {task.description
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&nbsp;/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {due && (
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {due}
                </span>
              )}
              {task._count.comments > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {task._count.comments}{" "}
                  {task._count.comments === 1 ? "comment" : "comments"}
                </span>
              )}
              <span>From {task.createdBy.name}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
