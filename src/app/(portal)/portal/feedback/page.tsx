"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageCircle,
} from "lucide-react";
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
        <Loader2 className="h-8 w-8 animate-spin text-[#E71D57]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page head ──────────────────────────────────────────────── */}
      <div>
        <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[44px]">
          Feedback
        </h1>
        <p className="mt-1 text-base font-semibold text-[#6B7794]">
          Items your therapist has shared with you. Open one to leave a
          comment or suggest changes.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="sub-edge rounded-[26px] bg-white p-7 text-center">
          <span className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[18px] border-[3px] border-[#12235B] bg-[#17B0A7]">
            <MessageCircle className="h-7 w-7 text-white" />
          </span>
          <p className="sub-display mt-4 text-2xl">Nothing shared yet</p>
          <p className="mt-1 text-[15px] font-semibold text-[#6B7794]">
            When your therapist shares a task with you, it will appear here.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="sub-display text-2xl">
                Open{" "}
                <span className="text-[#6B7794]">&middot; {active.length}</span>
              </h2>
              <p className="mb-4 mt-0.5 text-[15px] font-semibold text-[#6B7794]">
                Awaiting your review
              </p>
              <div className="flex flex-col gap-4">
                {active.map((t, i) => (
                  <TaskRow key={t.id} task={t} index={i} />
                ))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="sub-display inline-flex items-center gap-2 text-2xl">
                <CheckCircle2 className="h-6 w-6 text-[#17B0A7]" />
                Completed{" "}
                <span className="text-[#6B7794]">&middot; {done.length}</span>
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {done.map((t, i) => (
                  <TaskRow key={t.id} task={t} index={i} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// Accent stripe rotates through the brand colours so a stack of cards
// reads as Submarine, not a table.
const ACCENTS = ["#17B0A7", "#E71D57", "#FFC93C"] as const;

function TaskRow({ task, index }: { task: Task; index: number }) {
  const due = formatDue(task.dueDate);
  const isDone = task.status === "done";
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <Link
      href={`/portal/feedback/${task.id}`}
      className={cn(
        "sub-press block rounded-[26px] bg-white p-5 sm:p-6",
        isDone
          ? "border-[3px] border-[#D9D2C4] opacity-80"
          : "sub-edge",
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className="mt-1 h-[52px] w-[10px] shrink-0 rounded-full border-2 border-[#12235B]"
          style={{ backgroundColor: isDone ? "#D9D2C4" : accent }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "sub-display text-[20px] leading-tight",
                isDone && "line-through text-[#6B7794]",
              )}
            >
              {task.title}
            </h3>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
          {task.description && (
            <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold text-[#3D4A6B]">
              {task.description
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/g, " ")
                .replace(/\s+/g, " ")
                .trim()}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-bold text-[#6B7794]">
            {due && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {due}
              </span>
            )}
            {task._count.comments > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                {task._count.comments}{" "}
                {task._count.comments === 1 ? "comment" : "comments"}
              </span>
            )}
            <span>From {task.createdBy.name}</span>
          </div>
        </div>
        <ChevronRight
          className="mt-1 hidden h-5 w-5 shrink-0 text-[#6B7794] sm:block"
          aria-hidden
        />
      </div>
    </Link>
  );
}
