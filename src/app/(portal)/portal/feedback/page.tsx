"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/components/tasks/priority-badge";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";
import { Toolbar, Panel, Empty } from "@/components/ds";

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
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Portal — feedback list. Parent-facing view of tasks their therapist
 * has shared with them.
 */
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
    <div className="space-y-6">
      <Toolbar
        title="Feedback"
        subtitle="Items your therapist has shared with you. Open one to leave a comment or suggest changes."
      />

      {tasks.length === 0 ? (
        <Panel>
          <div className="ds-empty">
            <MessageCircle
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>Nothing shared yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              When your therapist shares a task with you, it will appear here.
            </p>
          </div>
        </Panel>
      ) : (
        <>
          {active.length > 0 && (
            <Panel
              title={`Open · ${active.length}`}
              subtitle="Awaiting your review"
            >
              <div className="divide-y divide-border">
                {active.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </Panel>
          )}
          {done.length > 0 && (
            <Panel
              title={
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Completed · {done.length}
                </span>
              }
            >
              <div className="divide-y divide-border">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const due = formatDue(task.dueDate);
  return (
    <Link
      href={`/portal/feedback/${task.id}`}
      className="block px-5 py-4 transition-colors hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-sm font-semibold",
                task.status === "done" &&
                  "line-through text-muted-foreground",
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
  );
}
