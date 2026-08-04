"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, X, Play, Pencil, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextView } from "@/components/ui/rich-text-view";

export interface Attachment {
  id: string;
  url: string;
  mimeType: string;
  filename: string;
  sizeBytes: number;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
  attachments: Attachment[];
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

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentView({ a }: { a: Attachment }) {
  if (a.mimeType.startsWith("image/")) {
    return (
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt={a.filename}
          className="max-h-64 w-auto object-cover"
        />
      </a>
    );
  }
  if (a.mimeType.startsWith("video/")) {
    return (
      <video
        src={a.url}
        controls
        preload="metadata"
        className="max-h-80 w-full rounded-lg border border-border bg-black"
      />
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
    >
      <Paperclip className="h-3 w-3" /> {a.filename}
    </a>
  );
}

export function CommentList({
  comments,
  otherRoleLabel,
  isOtherRole,
  taskId,
  canModify,
  onChanged,
}: {
  comments: Comment[];
  /** Label shown next to authors with the "other" role (e.g. "Client" on admin, "Therapist" on portal). */
  otherRoleLabel: string;
  /** Returns true if the author's role should get the "other" badge. */
  isOtherRole: (role: string) => boolean;
  /** Needed to build the edit/delete URL. Omit to render read-only. */
  taskId?: string;
  /** Whether the signed-in user may edit/delete a given comment. Omit for
   * read-only. Admins get this for every comment so they can correct the ones
   * the hourly maintenance agent posts. */
  canModify?: (c: Comment) => boolean;
  /** Called after a successful edit or delete so the parent can refetch. */
  onChanged?: () => void;
}) {
  if (comments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No comments yet.</p>
    );
  }
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <CommentRow
          key={c.id}
          c={c}
          otherRoleLabel={otherRoleLabel}
          isOtherRole={isOtherRole}
          taskId={taskId}
          editable={!!taskId && !!canModify && canModify(c)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function CommentRow({
  c,
  otherRoleLabel,
  isOtherRole,
  taskId,
  editable,
  onChanged,
}: {
  c: Comment;
  otherRoleLabel: string;
  isOtherRole: (role: string) => boolean;
  taskId?: string;
  editable: boolean;
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (htmlIsEmpty(draft)) {
      setError("A comment can't be empty — use Delete instead.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditing(false);
      onChanged?.();
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this comment? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      onChanged?.();
    } catch {
      setError("Couldn't delete that — try again.");
      setBusy(false);
    }
  }

  return (
        <div className="group flex items-start gap-2">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: `hsl(${avatarHue(c.author.id)} 70% 50%)` }}
          >
            {initials(c.author.name)}
          </span>
          <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">{c.author.name}</span>
              {isOtherRole(c.author.role) && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                  {otherRoleLabel}
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
            {editing ? (
              <div className="mt-2">
                <RichTextEditor value={draft} onChange={setDraft} maxHeight={260} />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(c.body);
                      setEditing(false);
                      setError("");
                    }}
                    disabled={busy}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              c.body && <RichTextView html={c.body} className="mt-1 text-sm" />
            )}
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            {c.attachments.length > 0 && (
              <div className="mt-2 grid gap-2">
                {c.attachments.map((a) => (
                  <AttachmentView key={a.id} a={a} />
                ))}
              </div>
            )}
          </div>

          {/* Edit / delete. Shown on hover on a mouse, always on touch — a
              hover-only control is unreachable on a phone. */}
          {editable && !editing && (
            <div className="flex flex-shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Edit this comment"
                aria-label="Edit comment"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                title="Delete this comment"
                aria-label="Delete comment"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
  );
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

/** Strip tags to decide whether the editor is empty. */
function htmlIsEmpty(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim().length === 0;
}

export function CommentComposer({
  taskId,
  onPosted,
  placeholder = "Write a comment…",
}: {
  taskId: string;
  onPosted: () => void;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((prev) => [
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
          typeof data.error === "string" ? data.error : "Upload failed"
        );
      }
      const data = (await res.json()) as {
        url: string;
        mimeType: string;
        filename: string;
        sizeBytes: number;
      };
      setPending((prev) =>
        prev.map((p) =>
          p.tempId === tempId ? { ...p, uploading: false, url: data.url } : p
        )
      );
    } catch (e) {
      setPending((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, uploading: false, error: (e as Error).message }
            : p
        )
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 10)) {
      uploadOne(f);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function removePending(tempId: string) {
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  async function post() {
    const ready = pending.filter((p) => !p.uploading && p.url && !p.error);
    const empty = htmlIsEmpty(body);
    if (empty && ready.length === 0) return;
    setSubmitting(true);
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: empty ? "" : body,
        attachments: ready.map((p) => ({
          url: p.url,
          mimeType: p.mimeType,
          filename: p.filename,
          sizeBytes: p.sizeBytes,
        })),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setBody("");
      setEditorKey((k) => k + 1); // force-remount so the editor clears
      setPending([]);
      onPosted();
    }
  }

  const anyUploading = pending.some((p) => p.uploading);
  const composerEmpty = htmlIsEmpty(body);

  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.tempId}
              className={cn(
                "group relative flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
                p.error
                  ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30"
                  : "border-border bg-muted/50"
              )}
            >
              {p.uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : p.mimeType.startsWith("image/") ? (
                <Paperclip className="h-3 w-3" />
              ) : p.mimeType.startsWith("video/") ? (
                <Play className="h-3 w-3" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              <span className="max-w-[140px] truncate">{p.filename}</span>
              <span className="text-muted-foreground">
                {humanSize(p.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => removePending(p.tempId)}
                className="rounded p-0.5 hover:bg-background"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex-1">
          <RichTextEditor
            key={editorKey}
            value={body}
            onChange={setBody}
            placeholder={placeholder}
            compact
            minHeight={72}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
            title="Attach image or video"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={post}
            disabled={
              submitting ||
              anyUploading ||
              (composerEmpty && pending.filter((p) => p.url).length === 0)
            }
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
