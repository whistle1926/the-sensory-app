"use client";

import { useEffect, useRef, useState } from "react";
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
  Sparkles,
  Check,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import type {
  ProgrammeItem,
  ProgrammeSection,
  DemoStep,
} from "@/lib/programme-sections";

// Keep the old exported names to avoid changing callers.
export type Section = ProgrammeSection;
export type { ProgrammeItem, DemoStep };

export interface ProgrammeFormValues {
  title: string;
  description: string;
  sections: ProgrammeSection[];
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
  const [sections, setSections] = useState<ProgrammeSection[]>(
    initial.sections.length > 0
      ? initial.sections
      : [{ title: "", items: [{ text: "" }] }],
  );
  // Tracks which item is currently generating a demo: `${sectionIndex}-${itemIndex}`.
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  // Which item's demo popover is open.
  const [openDemoKey, setOpenDemoKey] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Focus tracking — after adding a new section or item, remember which field
  // should receive focus and apply it in the next render.
  const itemRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const sectionTitleRefs = useRef<Map<number, HTMLInputElement | null>>(
    new Map(),
  );
  const [pendingFocus, setPendingFocus] = useState<
    | { kind: "item"; section: number; item: number }
    | { kind: "section"; section: number }
    | null
  >(null);

  useEffect(() => {
    if (!pendingFocus) return;
    if (pendingFocus.kind === "item") {
      const key = `${pendingFocus.section}-${pendingFocus.item}`;
      const input = itemRefs.current.get(key);
      input?.focus();
    } else {
      const input = sectionTitleRefs.current.get(pendingFocus.section);
      input?.focus();
    }
    setPendingFocus(null);
  }, [pendingFocus]);

  function updateSectionTitle(index: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title: value } : s)),
    );
  }

  function addSection() {
    setSections((prev) => {
      const next = [...prev, { title: "", items: [{ text: "" }] }];
      setPendingFocus({ kind: "section", section: next.length - 1 });
      return next;
    });
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(
    sectionIndex: number,
    itemIndex: number,
    patch: Partial<ProgrammeItem>,
  ) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const items = s.items.map((it, k) =>
          k === itemIndex ? { ...it, ...patch } : it,
        );
        return { ...s, items };
      }),
    );
  }

  function updateItemText(
    sectionIndex: number,
    itemIndex: number,
    value: string,
  ) {
    updateItem(sectionIndex, itemIndex, { text: value });
  }

  function updateDemoCaption(
    sectionIndex: number,
    itemIndex: number,
    stepIndex: number,
    caption: string,
  ) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const items = s.items.map((it, k) => {
          if (k !== itemIndex) return it;
          if (!it.demoSteps) return it;
          const nextSteps = it.demoSteps.map((step, j) =>
            j === stepIndex ? { ...step, caption } : step,
          );
          return { ...it, demoSteps: nextSteps };
        });
        return { ...s, items };
      }),
    );
  }

  function addItem(sectionIndex: number) {
    setSections((prev) => {
      const next = prev.map((s, i) =>
        i === sectionIndex ? { ...s, items: [...s.items, { text: "" }] } : s,
      );
      const newItemIndex = next[sectionIndex].items.length - 1;
      setPendingFocus({
        kind: "item",
        section: sectionIndex,
        item: newItemIndex,
      });
      return next;
    });
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        return { ...s, items: s.items.filter((_, k) => k !== itemIndex) };
      }),
    );
  }

  async function generateDemo(
    sectionIndex: number,
    itemIndex: number,
    exerciseText: string,
  ) {
    const key = `${sectionIndex}-${itemIndex}`;
    setGeneratingKey(key);
    setDemoError("");
    try {
      const res = await fetch("/api/programmes/generate-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDemoError(data.error || "Could not generate demo");
        return;
      }
      const steps: DemoStep[] = Array.isArray(data.steps) ? data.steps : [];
      if (steps.length === 0) {
        setDemoError("No steps returned");
        return;
      }
      updateItem(sectionIndex, itemIndex, { demoSteps: steps });
      setOpenDemoKey(key);
    } catch {
      setDemoError("Network error generating demo");
    } finally {
      setGeneratingKey(null);
    }
  }

  function removeDemo(sectionIndex: number, itemIndex: number) {
    updateItem(sectionIndex, itemIndex, { demoSteps: undefined });
    setOpenDemoKey(null);
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
            items: s.items
              .map((it) => ({
                text: it.text.trim(),
                // Only send optional fields when present — keeps the payload clean.
                ...(it.demoSteps && it.demoSteps.length > 0
                  ? {
                      demoSteps: it.demoSteps.map((step) => ({
                        caption: step.caption.trim(),
                        imageUrl: step.imageUrl,
                      })),
                    }
                  : {}),
                ...(it.videoUrl ? { videoUrl: it.videoUrl } : {}),
              }))
              .filter((it) => it.text.length > 0),
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

      {demoError && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          Demo generation: {demoError}
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
                    ref={(el) => {
                      if (el) sectionTitleRefs.current.set(sIndex, el);
                      else sectionTitleRefs.current.delete(sIndex);
                    }}
                    value={section.title}
                    onChange={(e) => updateSectionTitle(sIndex, e.target.value)}
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
                  {section.items.map((item, iIndex) => {
                    const refKey = `${sIndex}-${iIndex}`;
                    const isGenerating = generatingKey === refKey;
                    const hasDemo =
                      !!item.demoSteps && item.demoSteps.length > 0;
                    const isOpen = openDemoKey === refKey;
                    return (
                      <div key={iIndex} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <Input
                            ref={(el) => {
                              if (el) itemRefs.current.set(refKey, el);
                              else itemRefs.current.delete(refKey);
                            }}
                            value={item.text}
                            onChange={(e) =>
                              updateItemText(sIndex, iIndex, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addItem(sIndex);
                              }
                            }}
                            placeholder="Activity or item"
                            className="h-9"
                          />

                          {/* Demo button: Generate / Demo ✓ */}
                          <button
                            type="button"
                            onClick={() => {
                              if (hasDemo) {
                                setOpenDemoKey(isOpen ? null : refKey);
                                return;
                              }
                              if (!item.text.trim()) return;
                              generateDemo(sIndex, iIndex, item.text);
                            }}
                            disabled={isGenerating || (!hasDemo && !item.text.trim())}
                            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              hasDemo
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                            title={
                              hasDemo
                                ? "View / edit demo"
                                : "Generate AI demo illustration"
                            }
                          >
                            {isGenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : hasDemo ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {isGenerating
                              ? "Generating…"
                              : hasDemo
                                ? "Demo"
                                : "Demo"}
                          </button>

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

                        {/* Inline demo editor — shows when the user clicks the Demo button on an item with existing demoSteps */}
                        {isOpen && hasDemo && item.demoSteps && (
                          <div className="ml-3.5 rounded-xl border border-border bg-muted/30 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Demo cards
                              </p>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    generateDemo(sIndex, iIndex, item.text)
                                  }
                                  disabled={isGenerating}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
                                  title="Regenerate with the same text"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Regenerate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeDemo(sIndex, iIndex)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {item.demoSteps.map((step, stepIndex) => (
                                <div
                                  key={stepIndex}
                                  className="overflow-hidden rounded-lg border border-border bg-card"
                                >
                                  {step.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={step.imageUrl}
                                      alt={step.caption}
                                      className="aspect-square w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex aspect-square w-full items-center justify-center bg-muted">
                                      <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                                    </div>
                                  )}
                                  <div className="p-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      Step {stepIndex + 1}
                                    </p>
                                    <Input
                                      value={step.caption}
                                      onChange={(e) =>
                                        updateDemoCaption(
                                          sIndex,
                                          iIndex,
                                          stepIndex,
                                          e.target.value,
                                        )
                                      }
                                      className="mt-1 h-8 text-xs"
                                      placeholder="Caption"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

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
