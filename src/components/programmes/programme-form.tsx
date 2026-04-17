"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  GripVertical,
  X,
} from "lucide-react";

export interface Section {
  title: string;
  items: string[];
}

export interface ProgrammeFormValues {
  title: string;
  description: string;
  sections: Section[];
}

interface Props {
  programmeId?: string; // undefined = create mode
  initial: ProgrammeFormValues;
}

/**
 * Full editor for a programme template. Handles both create and edit flows —
 * `programmeId` discriminates. Sections and items are freely add/remove/reorder.
 */
export function ProgrammeForm({ programmeId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [sections, setSections] = useState<Section[]>(
    initial.sections.length > 0 ? initial.sections : [{ title: "", items: [""] }],
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function updateSection(
    index: number,
    field: keyof Section,
    value: string | string[],
  ) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }

  function addSection() {
    setSections((prev) => [...prev, { title: "", items: [""] }]);
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(sectionIndex: number, itemIndex: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const items = [...s.items];
        items[itemIndex] = value;
        return { ...s, items };
      }),
    );
  }

  function addItem(sectionIndex: number) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, items: [...s.items, ""] } : s,
      ),
    );
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        return { ...s, items: s.items.filter((_, k) => k !== itemIndex) };
      }),
    );
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, overIndex: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === overIndex) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(overIndex);
  }

  async function handleSave() {
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        sections: sections
          .map((s) => ({
            title: s.title.trim(),
            items: s.items.map((i) => i.trim()).filter((i) => i.length > 0),
          }))
          .filter((s) => s.title || s.items.length > 0),
      };

      const res = programmeId
        ? await fetch(`/api/programmes/${programmeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/programmes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to save programme.");
        setSaving(false);
        return;
      }

      router.push("/programmes");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!programmeId) return;
    if (
      !confirm(
        "Delete this programme template? This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/programmes/${programmeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Failed to delete programme.");
        setDeleting(false);
        return;
      }
      router.push("/programmes");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/programmes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to programmes
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {programmeId ? "Edit Programme" : "New Programme"}
        </h1>
        {programmeId && (
          <Button variant="outline" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programme Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="progTitle">Title *</Label>
            <Input
              id="progTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sensory Diet Template — Proprioceptive Focus"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="progDescription">Description</Label>
            <Textarea
              id="progDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of who this is for and what it covers."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sections
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Group activities by time of day, week, or theme. Drag to reorder.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Section
          </Button>
        </div>

        {sections.map((section, sIndex) => (
          <div
            key={sIndex}
            draggable
            onDragStart={() => setDragIndex(sIndex)}
            onDragOver={(e) => handleDragOver(e, sIndex)}
            onDragEnd={() => setDragIndex(null)}
            className={`rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] transition-opacity ${
              dragIndex === sIndex ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 cursor-grab text-muted-foreground/60">
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={section.title}
                    onChange={(e) =>
                      updateSection(sIndex, "title", e.target.value)
                    }
                    placeholder="Section title (e.g. Morning, School day)"
                    className="font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(sIndex)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 pl-1">
                  {section.items.map((item, iIndex) => (
                    <div key={iIndex} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <Input
                        value={item}
                        onChange={(e) =>
                          updateItem(sIndex, iIndex, e.target.value)
                        }
                        placeholder="Activity or item"
                        className="h-9"
                      />
                      {section.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(sIndex, iIndex)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addItem(sIndex)}
                    className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Add item
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {sections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No sections yet. Click “Add Section” to get started.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {programmeId ? "Save Changes" : "Create Programme"}
        </Button>
        <Link
          href="/programmes"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
