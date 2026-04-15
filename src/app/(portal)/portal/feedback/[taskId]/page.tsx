"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/components/tasks/priority-badge";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
}
interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  createdBy: { id: string; name: string };
  comments: Comment[];
  createdAt: string;
}

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

export default function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/portal/feedback/${taskId}`);
    if (res.ok) setTask(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function postComment() {
    const body = comment.trim();
    if (!body) return;
    setSubmitting(true);
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSubmitting(false);
    if (res.ok) {
      setComment("");
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/feedback"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-sm text-muted-foreground">Not found.</p>
      </div>
    );
  }

  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/feedback"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feedback
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={cn(
              "text-xl font-bold tracking-tight",
              task.status === "done" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </h1>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        {task.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">
            {task.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {due && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {due}
            </span>
          )}
          <span>Shared by {task.createdBy.name}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageCircle className="h-4 w-4" /> Comments{" "}
          {task.comments.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({task.comments.length})
            </span>
          )}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Use this space to share feedback or request changes.
        </p>

        <div className="mt-4 space-y-3">
          {task.comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No comments yet — say hi or share any thoughts.
            </p>
          ) : (
            task.comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{
                    backgroundColor: `hsl(${avatarHue(c.author.id)} 70% 50%)`,
                  }}
                >
                  {initials(c.author.name)}
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">
                      {c.author.name}
                    </span>
                    {c.author.role !== "CLIENT" && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        Therapist
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              </div>
            ))
          )}
          <div className="flex items-start gap-2 pt-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment or request a change…"
              rows={3}
              className="flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={postComment}
              disabled={!comment.trim() || submitting}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
