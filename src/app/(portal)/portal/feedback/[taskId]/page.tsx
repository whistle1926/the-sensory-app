"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/components/tasks/priority-badge";
import {
  CommentComposer,
  CommentList,
  type Comment,
} from "@/components/tasks/comment-thread";
import { RichTextView } from "@/components/ui/rich-text-view";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";
import { Panel } from "@/components/ds";

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

export default function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

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
        className="ds-link inline-flex items-center"
        style={{ fontWeight: 500 }}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to feedback
      </Link>

      <Panel padded>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={cn(
              "text-xl font-bold tracking-tight",
              task.status === "done" && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </h1>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        {task.description && (
          <RichTextView
            html={task.description}
            className="mt-3 text-sm text-foreground/90"
          />
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
      </Panel>

      <Panel
        title={
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-primary" /> Comments
            {task.comments.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({task.comments.length})
              </span>
            )}
          </span>
        }
        subtitle="Use this space to share feedback or request changes."
        padded
      >
        <div className="space-y-4">
          <CommentList
            comments={task.comments}
            otherRoleLabel="Therapist"
            isOtherRole={(r) => r !== "CLIENT"}
          />
          <CommentComposer
            taskId={task.id}
            onPosted={load}
            placeholder="Write a comment or request a change…"
          />
        </div>
      </Panel>
    </div>
  );
}
