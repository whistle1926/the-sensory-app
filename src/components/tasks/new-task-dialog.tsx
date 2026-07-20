"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, X, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceNotesRecorder } from "@/components/reports/voice-notes-recorder";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/tasks";

interface Member {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface Members {
  team: Member[];
  clients: Member[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface PendingAttachment {
  tempId: string;
  url?: string;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  uploading: boolean;
  error?: string;
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

/** Deterministic avatar bg colour per user — stable across renders. */
function avatarHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export function NewTaskDialog({ open, onOpenChange, onCreated }: Props) {
  const [members, setMembers] = useState<Members>({ team: [], clients: [] });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [clientUserId, setClientUserId] = useState<string>("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/tasks/members")
      .then((r) => r.json())
      .then(setMembers)
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) {
      // reset on close
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setAssigneeIds([]);
      setClientUserId("");
      setSubtasks([]);
      setAttachments([]);
      setError("");
    }
  }, [open]);

  async function uploadOne(file: File) {
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAttachments((prev) => [
      ...prev,
      {
        tempId,
        mimeType: file.type,
        filename: file.name,
        sizeBytes: file.size,
        uploading: true,
      },
    ]);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/uploads/comment-attachment", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Upload failed",
        );
      }
      const data = (await res.json()) as { url: string };
      setAttachments((prev) =>
        prev.map((p) =>
          p.tempId === tempId ? { ...p, uploading: false, url: data.url } : p,
        ),
      );
    } catch (e) {
      setAttachments((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, uploading: false, error: (e as Error).message }
            : p,
        ),
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 10)) uploadOne(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
        assigneeIds,
        clientUserId: clientUserId || null,
        subtasks: subtasks
          .map((t) => ({ title: t.trim() }))
          .filter((s) => s.title.length > 0),
        attachments: attachments
          .filter((a) => !a.uploading && a.url && !a.error)
          .map((a) => ({
            url: a.url,
            mimeType: a.mimeType,
            filename: a.filename,
            sizeBytes: a.sizeBytes,
          })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Failed to create task");
      return;
    }
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Task title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description <span className="text-muted-foreground/60">(optional)</span>
            </label>
            {/* Same recorder used on session notes + progress notes —
                handy for dictating context that's faster spoken than typed. */}
            <VoiceNotesRecorder value={description} onChange={setDescription} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any details or context, or use the recorder above to dictate…"
              rows={3}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Image / screenshot attachments — a picture often explains an
              issue far faster than words. Uploaded straight away; the URLs
              are attached to the task on submit. */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Screenshot / image <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ImagePlus className="h-4 w-4" />
              Upload an image to explain the issue
            </button>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div
                    key={a.tempId}
                    className={cn(
                      "group relative h-20 w-20 overflow-hidden rounded-lg border",
                      a.error ? "border-red-300" : "border-border",
                    )}
                    title={a.error ? a.error : a.filename}
                  >
                    {a.url && !a.uploading ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={a.filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        {a.error ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((p) => p.tempId !== a.tempId),
                        )
                      }
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Priority
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(PRIORITY_DOT) as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs capitalize transition-colors",
                      priority === p
                        ? "border-primary bg-primary/5 font-semibold"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[p])} />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assign to <span className="text-muted-foreground/60">(select one or more)</span>
            </label>
            {members.team.length === 0 ? (
              <p className="text-xs text-muted-foreground">No team members found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.team.map((m) => {
                  const selected = assigneeIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={cn(
                        "flex min-w-[72px] flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary/5 font-semibold"
                          : "border-border bg-background hover:bg-muted"
                      )}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{
                          backgroundColor: `hsl(${avatarHue(m.id)} 70% 50%)`,
                        }}
                      >
                        {initials(m.name)}
                      </span>
                      <span className="max-w-[64px] truncate">
                        {m.name.split(" ")[0] || m.email}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {assigneeIds.length === 0
                ? "No one selected — task will be assigned to yourself."
                : `${assigneeIds.length} selected.`}
            </p>
          </div>

          {members.clients.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Share with client <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <select
                value={clientUserId}
                onChange={(e) => setClientUserId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              >
                <option value="">— Not shared —</option>
                {members.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                The client will see this task on their Feedback page and can leave comments.
              </p>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Subtasks
              </label>
              <button
                type="button"
                onClick={() => setSubtasks((p) => [...p, ""])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add subtask
              </button>
            </div>
            {subtasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
                + Add a subtask — break this task into steps
              </div>
            ) : (
              <div className="space-y-2">
                {subtasks.map((value, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={value}
                      onChange={(e) =>
                        setSubtasks((prev) =>
                          prev.map((v, idx) => (idx === i ? e.target.value : v))
                        )
                      }
                      placeholder={`Step ${i + 1}`}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSubtasks((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                      aria-label="Remove subtask"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !title.trim() ||
                submitting ||
                attachments.some((a) => a.uploading)
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
