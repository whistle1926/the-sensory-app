"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, FileText, Loader2, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface ProgressNote {
  id: string;
  clientId: string;
  authorId: string;
  sessionDate: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { name: string };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convert a Date to the `YYYY-MM-DDTHH:mm` format that datetime-local inputs expect. */
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProgressNotesSection({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [sessionDate, setSessionDate] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`);
      if (res.ok) {
        setNotes(await res.json());
      }
    } catch {
      // Network error — leave list as-is
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  function openNew() {
    setEditingNote(null);
    setSessionDate(toDateTimeLocal(new Date().toISOString()));
    setBody("");
    setEditorKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(note: ProgressNote) {
    setEditingNote(note);
    setSessionDate(toDateTimeLocal(note.sessionDate));
    setBody(note.body);
    setEditorKey((k) => k + 1);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!sessionDate || !body.replace(/<[^>]+>/g, "").trim()) return;
    setSaving(true);

    const payload: { sessionDate: string; body?: string } = {
      sessionDate: new Date(sessionDate).toISOString(),
      body,
    };

    try {
      if (editingNote) {
        await fetch(`/api/clients/${clientId}/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/clients/${clientId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      fetchNotes();
    } catch {
      // Network error — keep dialog open so the user can retry
    }
    setSaving(false);
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Delete this progress note? This cannot be undone.")) return;
    await fetch(`/api/clients/${clientId}/notes/${noteId}`, {
      method: "DELETE",
    });
    fetchNotes();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Progress Notes
            </span>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" data-icon="inline-start" />
              Add Note
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No progress notes yet. Add one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">
                        {formatDateTime(note.sessionDate)}
                      </span>
                      <span className="text-muted-foreground">
                        &middot; {note.author.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEdit(note)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Edit note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <RichTextView html={note.body} className="text-sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Edit Progress Note" : "Add Progress Note"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-session-date">Date &amp; Time</Label>
              <input
                id="note-session-date"
                type="datetime-local"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <RichTextEditor
                key={editorKey}
                value={body}
                onChange={setBody}
                placeholder="Write your progress note..."
                minHeight={160}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !sessionDate ||
                !body.replace(/<[^>]+>/g, "").trim()
              }
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingNote ? "Update Note" : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
