"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pin,
  PinOff,
  Plus,
  Save,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextView } from "@/components/ui/rich-text-view";
import { Empty } from "@/components/ds";

interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
}

/**
 * Team scratchpad panel shown inside the Tasks page when the "Notes" tab
 * is active.
 *
 * Notes are shared across all staff — anyone can create, edit, pin, or
 * delete. Keeps reference content (stage definitions, payment scripts,
 * onboarding checklists, meeting notes, etc.) in one place instead of
 * scattered across DMs and Google Docs.
 */
export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notes");
      if (res.ok) setNotes((await res.json()) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => {
      const plainBody = n.body.replace(/<[^>]+>/g, " ").toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        plainBody.includes(q) ||
        (n.author.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [notes, search]);

  function openNew() {
    setEditing({
      id: "",
      title: "",
      body: "",
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "", name: "", email: "" },
    });
    setIsNew(true);
  }

  function openEdit(n: Note) {
    setEditing(n);
    setIsNew(false);
  }

  async function handleSave(patch: { title: string; body: string }) {
    if (!editing) return;
    if (isNew) {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setEditing(null);
        setIsNew(false);
        load();
      }
    } else {
      const res = await fetch(`/api/notes/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setEditing(null);
        load();
      }
    }
  }

  async function togglePin(id: string, current: boolean) {
    // Optimistic flip
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !current } : n)),
    );
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !current }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note? This can't be undone.")) return;
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by title, content, or author"
          />
        </div>
        <Button type="button" onClick={openNew} className="rounded-xl">
          <Plus className="mr-1.5 h-4 w-4" />
          New note
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <StickyNote
            className="mx-auto h-8 w-8"
            style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
          />
          <p className="mt-3 text-sm font-semibold">No notes yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save reference content you&apos;ll want to come back to — scripts,
            onboarding steps, meeting notes.
          </p>
          <Button
            type="button"
            onClick={openNew}
            className="mt-4 rounded-xl"
            size="sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create your first note
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <Empty>No notes match your search.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openEdit(n)}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 flex-1 font-semibold">
                  {n.pinned && (
                    <Pin
                      className="mr-1 inline h-3.5 w-3.5 shrink-0 text-primary"
                      aria-hidden
                    />
                  )}
                  {n.title || <span className="italic opacity-60">Untitled</span>}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(n.id, n.pinned);
                  }}
                  className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  title={n.pinned ? "Unpin" : "Pin"}
                >
                  {n.pinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground">
                {plainPreview(n.body) || (
                  <span className="italic opacity-60">No content yet</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">
                  {n.author.name || n.author.email || "—"}
                </span>
                <span className="tabular-nums">
                  {formatDate(n.updatedAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <NoteEditor
          note={editing}
          isNew={isNew}
          onCancel={() => {
            setEditing(null);
            setIsNew(false);
          }}
          onSave={handleSave}
          onDelete={
            isNew
              ? undefined
              : () => handleDelete(editing.id).then(() => setEditing(null))
          }
        />
      )}
    </>
  );
}

/* ─── Editor dialog ──────────────────────────────────────────────── */

function NoteEditor({
  note,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  note: Note;
  isNew: boolean;
  onCancel: () => void;
  onSave: (patch: { title: string; body: string }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({ title: title.trim() || "Untitled", body });
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:!max-w-[720px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isNew ? "New note" : "Edit note"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "65vh" }}>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="What's this about?"
              autoFocus={isNew}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              minHeight={280}
              placeholder="Paste or type anything you want to reference later…"
            />
          </div>
          {!isNew && note.author.name && (
            <p className="text-xs text-muted-foreground">
              Created by <strong>{note.author.name}</strong> ·{" "}
              {formatDate(note.createdAt)}
              {note.updatedAt !== note.createdAt &&
                ` · updated ${formatDate(note.updatedAt)}`}
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-4">
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isNew ? "Create note" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function plainPreview(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

// Keep the unused import warnings happy in some strict builds
export type { Note };
// Silence any unused-variable warning in hot-reload dev
void RichTextView;
