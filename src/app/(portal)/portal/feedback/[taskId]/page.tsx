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

const BACK_LINK =
  "sub-press inline-flex items-center gap-1.5 rounded-full border-[3px] border-[#12235B] bg-white px-5 py-2.5 text-sm font-extrabold text-[#12235B]";

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
        <Loader2 className="h-8 w-8 animate-spin text-[#E71D57]" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-5">
        <Link href="/portal/feedback" className={BACK_LINK}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3.5 text-sm font-bold text-[#B81243]">
          Not found.
        </p>
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
      <Link href="/portal/feedback" className={BACK_LINK}>
        <ArrowLeft className="h-4 w-4" /> Back to feedback
      </Link>

      {/* ── The task ──────────────────────────────────────────────── */}
      <section className="sub-edge rounded-[26px] bg-white p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={cn(
              "sub-display text-[28px] leading-tight tracking-[-.6px] sm:text-[34px]",
              task.status === "done" && "line-through text-[#6B7794]",
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
            className="mt-4 text-base leading-relaxed text-[#3D4A6B]"
          />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-[#F2E4CD] pt-4 text-[13px] font-bold text-[#6B7794]">
          {due && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {due}
            </span>
          )}
          <span>Shared by {task.createdBy.name}</span>
        </div>
      </section>

      {/* ── Comments ──────────────────────────────────────────────── */}
      <section className="sub-edge rounded-[26px] bg-white p-6 sm:p-7">
        <h2 className="sub-display inline-flex items-center gap-2 text-2xl">
          <MessageCircle className="h-6 w-6 text-[#17B0A7]" /> Comments
          {task.comments.length > 0 && (
            <span className="text-[#6B7794]">({task.comments.length})</span>
          )}
        </h2>
        <p className="mb-5 mt-1 text-[15px] font-semibold text-[#6B7794]">
          Use this space to share feedback or request changes.
        </p>
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
      </section>
    </div>
  );
}
