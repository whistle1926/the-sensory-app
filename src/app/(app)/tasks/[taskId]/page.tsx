"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/components/tasks/priority-badge";
import {
  CommentComposer,
  CommentList,
  type Comment,
} from "@/components/tasks/comment-thread";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";

interface Assignee {
  user: { id: string; name: string; email: string; role: string };
}
interface Subtask {
  id: string;
  title: string;
  done: boolean;
}
interface Attachment {
  id: string;
  url: string;
  mimeType: string;
  filename: string;
}
interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  createdBy: { id: string; name: string };
  clientUser: { id: string; name: string; email: string } | null;
  assignees: Assignee[];
  subtasks: Subtask[];
  attachments: Attachment[];
  comments: Comment[];
  createdAt: string;
  forReviewAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/** e.g. "18 Jul 2026, 2:32 pm" — date + time for the audit trail. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Human "time to fix" from logged → completed. Used to answer "how quick
 * was this turned around". Coarse buckets keep it readable: minutes under
 * 90m, hours under 2 days, otherwise whole days.
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

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSubtask, setNewSubtask] = useState("");

  // Track the last-saved description so we can show a dirty indicator and
  // a Save button next to the editor. The editor itself still auto-saves on
  // blur, but the explicit button makes the flow obvious for users.
  const [savedDescription, setSavedDescription] = useState<string>("");
  const [descSaveState, setDescSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/tasks/${taskId}`);
    if (res.ok) {
      const data = await res.json();
      setTask(data);
      setSavedDescription(data.description ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function patchTask(patch: Record<string, unknown>) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  /**
   * Dedicated description save — kept separate from patchTask so we can
   * surface a loading/saved state without reloading the whole task (which
   * would reset the editor cursor position mid-typing).
   */
  async function saveDescription(html: string) {
    setDescSaveState("saving");
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: html }),
      });
      if (!res.ok) throw new Error("save failed");
      setSavedDescription(html);
      setDescSaveState("saved");
      // Auto-reset the "Saved" badge after a moment so it doesn't linger.
      setTimeout(() => {
        setDescSaveState((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } catch {
      setDescSaveState("error");
    }
  }

  async function addSubtask() {
    const title = newSubtask.trim();
    if (!title) return;
    setNewSubtask("");
    await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    load();
  }

  async function toggleSubtask(sub: Subtask) {
    await fetch(`/api/subtasks/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !sub.done }),
    });
    load();
  }

  async function removeSubtask(id: string) {
    await fetch(`/api/subtasks/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteTask() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    router.push("/tasks");
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
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tasks
        </Link>
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  const completedSubs = task.subtasks.filter((s) => s.done).length;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueInput = due ? due.toISOString().slice(0, 10) : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tasks
        </Link>
        <button
          type="button"
          onClick={deleteTask}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete task
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <input
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== task.title) return;
                if (e.target.value.trim() !== task.title) {
                  patchTask({ title: e.target.value.trim() || task.title });
                }
              }}
              className="w-full bg-transparent text-xl font-bold tracking-tight outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              <span className="text-[11px] text-muted-foreground">
                Logged {formatDateTime(task.createdAt)} by {task.createdBy.name}
              </span>
              {task.forReviewAt && (
                <span className="text-[11px] font-medium text-green-600 dark:text-green-400">
                  · Fixed {formatDateTime(task.forReviewAt)}
                  {(() => {
                    const d = humanDuration(task.createdAt, task.forReviewAt!);
                    return d ? ` · in ${d}` : "";
                  })()}
                </span>
              )}
              {task.completedAt && (
                <span className="text-[11px] text-muted-foreground">
                  · Signed off {formatDateTime(task.completedAt)}
                </span>
              )}
            </div>
            <div className="mt-4">
              <RichTextEditor
                value={task.description ?? ""}
                onChange={(html) => {
                  setTask({ ...task, description: html });
                  // Any keystroke that changes the value resets a "Saved" flash.
                  if (descSaveState === "saved") setDescSaveState("idle");
                }}
                onBlur={(html) => {
                  if (html !== savedDescription) saveDescription(html);
                }}
                placeholder="Add a description — paste a link, embed a video, or format your notes…"
                minHeight={100}
              />
              {/* Save controls — always visible, reacts to dirty state */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {descSaveState === "saving" && (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </span>
                  )}
                  {descSaveState === "saved" && (
                    <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                  {descSaveState === "error" && (
                    <span className="text-red-600 dark:text-red-400">
                      Save failed — click Save to retry
                    </span>
                  )}
                  {descSaveState === "idle" &&
                    (task.description ?? "") !== savedDescription && (
                      <span>Unsaved changes</span>
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => saveDescription(task.description ?? "")}
                  disabled={
                    descSaveState === "saving" ||
                    (task.description ?? "") === savedDescription
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    (task.description ?? "") !== savedDescription ||
                      descSaveState === "error"
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : "border border-border bg-background text-muted-foreground",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {descSaveState === "saving" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>

          {task.attachments.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-sm font-semibold">
                Attachments{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({task.attachments.length})
                </span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {task.attachments.map((a) =>
                  a.mimeType.startsWith("image/") ? (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-28 w-28 overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02]"
                      title={a.filename}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={a.filename}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-muted"
                    >
                      📎 {a.filename}
                    </a>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Subtasks{" "}
                {task.subtasks.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({completedSubs}/{task.subtasks.length})
                  </span>
                )}
              </h2>
            </div>
            <div className="mt-3 space-y-1.5">
              {task.subtasks.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => toggleSubtask(s)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      s.done && "text-muted-foreground line-through"
                    )}
                  >
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubtask(s.id)}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                    aria-label="Remove subtask"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Add a subtask…"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  disabled={!newSubtask.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
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
            {task.clientUser && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Shared with {task.clientUser.name} — they can see and reply to
                this thread from their Feedback page.
              </p>
            )}
            <div className="mt-4 space-y-4">
              <CommentList
                comments={task.comments}
                otherRoleLabel="Client"
                isOtherRole={(r) => r === "CLIENT"}
              />
              <CommentComposer taskId={task.id} onPosted={load} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </h2>
            <div className="mt-2 grid gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => patchTask({ status: s.key })}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                    task.status === s.key
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Priority
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => patchTask({ priority: p })}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs capitalize transition-colors",
                    task.priority === p
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarIcon className="mr-1 inline h-3 w-3" /> Due date
            </h2>
            <input
              type="date"
              value={dueInput}
              onChange={(e) =>
                patchTask({ dueDate: e.target.value || null })
              }
              className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-primary/50"
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assignees
            </h2>
            {task.assignees.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No one assigned.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {task.assignees.map((a) => (
                  <li key={a.user.id} className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{
                        backgroundColor: `hsl(${avatarHue(a.user.id)} 70% 50%)`,
                      }}
                    >
                      {initials(a.user.name)}
                    </span>
                    <span className="truncate text-xs">{a.user.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {task.clientUser && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <UserCircle2 className="mr-1 inline h-3 w-3" /> Shared with
                client
              </h2>
              <p className="mt-2 text-xs font-semibold">
                {task.clientUser.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {task.clientUser.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
