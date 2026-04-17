"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Settings as SettingsIcon,
  AlignLeft,
  Circle,
  CheckSquare,
  Calendar,
  Hash,
  Image as ImageIcon,
  Mail,
  Phone,
  Star,
  List,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FIELD_TYPE_CATALOGUE,
  type FormField,
  type FormFieldType,
  type FormSettings,
} from "@/lib/forms";
import { SendFormDialog } from "@/components/forms/send-form-dialog";

export interface FormBuilderInitial {
  id?: string;
  title: string;
  description: string;
  slug?: string;
  isPublished: boolean;
  fields: FormField[];
  settings: FormSettings;
}

interface Props {
  formId?: string; // undefined = create mode
  initial: FormBuilderInitial;
}

const TYPE_ICONS: Record<FormFieldType, React.ComponentType<{ className?: string }>> = {
  short_text: Type,
  long_text: AlignLeft,
  email: Mail,
  phone: Phone,
  number: Hash,
  date: Calendar,
  select: List,
  radio: Circle,
  checkbox: CheckSquare,
  rating: Star,
  file: ImageIcon,
  heading: Type,
  paragraph: AlignLeft,
};

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `f_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function defaultField(type: FormFieldType): FormField {
  const base: FormField = { id: randomId(), type, label: "" };
  if (["select", "radio", "checkbox"].includes(type)) {
    base.options = [
      { label: "Option 1", value: "option_1" },
      { label: "Option 2", value: "option_2" },
    ];
  }
  if (type === "rating") {
    base.scale = { min: 1, max: 5 };
  }
  if (type === "file") {
    base.accept = ["image/", "application/pdf"];
    base.maxSizeMb = 10;
  }
  return base;
}

export function FormBuilder({ formId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [fields, setFields] = useState<FormField[]>(initial.fields);
  const [settings, setSettings] = useState<FormSettings>(initial.settings);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [activeTab, setActiveTab] = useState<"fields" | "settings">("fields");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(
    fields.length > 0 ? fields[0].id : null,
  );
  const [sendOpen, setSendOpen] = useState(false);

  // Focus a newly-added field's label for quick entry.
  const labelRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingFocus) return;
    labelRefs.current.get(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  const publicUrl = useMemo(() => {
    if (!slug) return "";
    if (typeof window === "undefined") return `/f/${slug}`;
    return `${window.location.origin}/f/${slug}`;
  }, [slug]);

  function addField(type: FormFieldType) {
    const f = defaultField(type);
    setFields((prev) => [...prev, f]);
    setExpandedFieldId(f.id);
    setPendingFocus(f.id);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, over: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === over) return;
    setFields((prev) => {
      const next = [...prev];
      const [m] = next.splice(dragIndex, 1);
      next.splice(over, 0, m);
      return next;
    });
    setDragIndex(over);
  }

  async function save(extra?: Partial<{ isPublished: boolean }>): Promise<
    string | null
  > {
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return null;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      fields,
      settings,
      ...(extra ?? {}),
    };
    try {
      let res: Response;
      if (formId) {
        res = await fetch(`/api/forms/${formId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to save form.");
        setSaving(false);
        return null;
      }
      const data = await res.json();
      setSlug(data.slug ?? slug);
      if (typeof data.isPublished === "boolean") setIsPublished(data.isPublished);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      if (!formId && data.id) {
        router.replace(`/forms/${data.id}/edit`);
      }
      return data.id as string;
    } catch {
      setError("Something went wrong. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    const next = !isPublished;
    await save({ isPublished: next });
  }

  async function handleDelete() {
    if (!formId) return;
    if (!confirm("Delete this form? All submissions will be removed too.")) return;
    setDeleting(true);
    const res = await fetch(`/api/forms/${formId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete form.");
      setDeleting(false);
      return;
    }
    router.push("/forms");
  }

  async function copyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/forms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to forms
        </Link>
        <div className="flex items-center gap-2">
          {formId && (
            <>
              <Link
                href={`/forms/${formId}/entries`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                View entries
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSendOpen(true)}
                disabled={!isPublished}
                title={!isPublished ? "Publish the form first" : "Send to clients"}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send form
              </Button>
            </>
          )}
          {formId && (
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {formId ? "Edit form" : "New form"}
          </h1>
          {slug && (
            <p className="mt-1 text-sm text-muted-foreground">
              Public URL:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{publicUrl}</code>
              <button
                type="button"
                onClick={copyUrl}
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
              {isPublished && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          <Button variant="outline" onClick={() => save()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button
            onClick={togglePublish}
            disabled={saving || !title.trim()}
            variant={isPublished ? "outline" : "default"}
          >
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formTitle">Title *</Label>
            <Input
              id="formTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Parent Intake Questionnaire"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="formDescription">Description (shown above the form)</Label>
            <Textarea
              id="formDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — introduce the form, explain what you'll do with the data."
            />
          </div>
        </CardContent>
      </Card>

      <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("fields")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
            activeTab === "fields"
              ? "bg-background shadow-[var(--shadow-sm)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Fields
          <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs font-bold">
            {fields.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
            activeTab === "settings"
              ? "bg-background shadow-[var(--shadow-sm)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <SettingsIcon className="mr-1 inline h-3.5 w-3.5" />
          Notifications
        </button>
      </div>

      {activeTab === "fields" ? (
        <FieldsTab
          fields={fields}
          expandedFieldId={expandedFieldId}
          setExpandedFieldId={setExpandedFieldId}
          labelRefs={labelRefs}
          dragIndex={dragIndex}
          setDragIndex={setDragIndex}
          handleDragOver={handleDragOver}
          addField={addField}
          updateField={updateField}
          removeField={removeField}
        />
      ) : (
        <SettingsTab settings={settings} setSettings={setSettings} />
      )}

      {formId && (
        <SendFormDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          formId={formId}
          formTitle={title}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Fields tab
// ───────────────────────────────────────────────────────────────────────

function FieldsTab({
  fields,
  expandedFieldId,
  setExpandedFieldId,
  labelRefs,
  dragIndex,
  setDragIndex,
  handleDragOver,
  addField,
  updateField,
  removeField,
}: {
  fields: FormField[];
  expandedFieldId: string | null;
  setExpandedFieldId: (id: string | null) => void;
  labelRefs: React.MutableRefObject<Map<string, HTMLInputElement | null>>;
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>, over: number) => void;
  addField: (type: FormFieldType) => void;
  updateField: (id: string, patch: Partial<FormField>) => void;
  removeField: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof FIELD_TYPE_CATALOGUE>();
    for (const entry of FIELD_TYPE_CATALOGUE) {
      const arr = byGroup.get(entry.group) ?? [];
      arr.push(entry);
      byGroup.set(entry.group, arr);
    }
    return byGroup;
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      <div className="space-y-2.5">
        {fields.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="text-sm font-semibold">No fields yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a field type from the right to add one.
            </p>
          </div>
        )}
        {fields.map((field, index) => {
          const isOpen = expandedFieldId === field.id;
          const Icon = TYPE_ICONS[field.type];
          return (
            <div
              key={field.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={() => setDragIndex(null)}
              className={`rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] transition-opacity ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="cursor-grab text-muted-foreground/50">
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedFieldId(isOpen ? null : field.id)
                  }
                  className="flex-1 text-left"
                >
                  <p className="text-sm font-semibold">
                    {field.label || (
                      <span className="italic text-muted-foreground">
                        Untitled field
                      </span>
                    )}
                    {field.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {
                      FIELD_TYPE_CATALOGUE.find((e) => e.type === field.type)
                        ?.label
                    }
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove field"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  <FieldEditor
                    field={field}
                    onChange={(patch) => updateField(field.id, patch)}
                    labelRef={(el) => {
                      if (el) labelRefs.current.set(field.id, el);
                      else labelRefs.current.delete(field.id);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="h-fit rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-sm)] lg:sticky lg:top-4">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add field
        </p>
        <div className="mt-2 space-y-3">
          {(["text", "choice", "date-number", "file", "layout"] as const).map(
            (group) => (
              <div key={group}>
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {
                    {
                      text: "Text",
                      choice: "Choice",
                      "date-number": "Date / number",
                      file: "File",
                      layout: "Layout",
                    }[group]
                  }
                </p>
                <div className="mt-1 grid gap-1">
                  {(groups.get(group) ?? []).map((entry) => {
                    const Icon = TYPE_ICONS[entry.type];
                    return (
                      <button
                        key={entry.type}
                        type="button"
                        onClick={() => addField(entry.type)}
                        className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs font-medium transition-colors hover:border-border hover:bg-muted"
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {entry.label}
                        <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Per-field editor
// ───────────────────────────────────────────────────────────────────────

function FieldEditor({
  field,
  onChange,
  labelRef,
}: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  labelRef: (el: HTMLInputElement | null) => void;
}) {
  if (field.type === "heading" || field.type === "paragraph") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">
            {field.type === "heading" ? "Heading text" : "Paragraph"}
          </Label>
          <Input
            ref={labelRef}
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={
              field.type === "heading" ? "Section title" : "Information / instructions…"
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Question / label</Label>
          <Input
            ref={labelRef}
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="What's your question?"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs">
          <input
            type="checkbox"
            checked={!!field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          Required
        </label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Help text (optional)</Label>
        <Input
          value={field.helpText ?? ""}
          onChange={(e) => onChange({ helpText: e.target.value })}
          placeholder="Shown beneath the label to help the respondent"
        />
      </div>

      {["short_text", "long_text", "email", "phone", "number"].includes(
        field.type,
      ) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Placeholder (optional)</Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
          />
        </div>
      )}

      {["select", "radio", "checkbox"].includes(field.type) && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ options })}
        />
      )}

      {field.type === "rating" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Min</Label>
            <Input
              type="number"
              min={0}
              value={field.scale?.min ?? 1}
              onChange={(e) =>
                onChange({
                  scale: {
                    ...(field.scale ?? { min: 1, max: 5 }),
                    min: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max</Label>
            <Input
              type="number"
              min={1}
              value={field.scale?.max ?? 5}
              onChange={(e) =>
                onChange({
                  scale: {
                    ...(field.scale ?? { min: 1, max: 5 }),
                    max: Number(e.target.value) || 5,
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {field.type === "file" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Accepted types (MIME prefixes, comma-separated)</Label>
            <Input
              value={(field.accept ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  accept: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="image/, application/pdf"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max size (MB)</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={field.maxSizeMb ?? 10}
              onChange={(e) =>
                onChange({
                  maxSizeMb: Math.min(20, Math.max(1, Number(e.target.value) || 10)),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  onChange: (o: Array<{ label: string; value: string }>) => void;
}) {
  function set(index: number, label: string) {
    const next = options.map((o, i) =>
      i === index
        ? { label, value: label.toLowerCase().replace(/\s+/g, "_").slice(0, 40) || `option_${i + 1}` }
        : o,
    );
    onChange(next);
  }
  function add() {
    onChange([
      ...options,
      { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` },
    ]);
  }
  function remove(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Options</Label>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{i + 1}.</span>
            <Input
              value={opt.label}
              onChange={(e) => set(i, e.target.value)}
              className="h-9"
            />
            {options.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove option"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus className="h-3 w-3" />
          Add option
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Notifications / settings tab
// ───────────────────────────────────────────────────────────────────────

function SettingsTab({
  settings,
  setSettings,
}: {
  settings: FormSettings;
  setSettings: (s: FormSettings) => void;
}) {
  const [notifyText, setNotifyText] = useState(
    (settings.notifyEmails ?? []).join(", "),
  );

  function update(patch: Partial<FormSettings>) {
    setSettings({ ...settings, ...patch });
  }

  function commitNotify(value: string) {
    const list = value
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
    update({ notifyEmails: list });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Who can fill this in?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => update({ requireLogin: false })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                !settings.requireLogin
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              }`}
            >
              <p className="font-semibold">Public</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anyone with the link can fill it in — no login needed. Best for
                new parents, referrals and consent forms.
              </p>
            </button>
            <button
              type="button"
              onClick={() => update({ requireLogin: true })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                settings.requireLogin
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              }`}
            >
              <p className="font-semibold">Signed-in only</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Visitors are redirected to sign in before filling. Use for
                existing clients where you want tighter access control.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">After submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Submit button text</Label>
            <Input
              value={settings.submitButtonText ?? ""}
              onChange={(e) => update({ submitButtonText: e.target.value })}
              placeholder="Submit"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Success message</Label>
            <Textarea
              value={settings.successMessage ?? ""}
              onChange={(e) => update({ successMessage: e.target.value })}
              placeholder="Thanks — we've got your response."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Email these addresses when a response arrives
            </Label>
            <Textarea
              value={notifyText}
              onChange={(e) => setNotifyText(e.target.value)}
              onBlur={(e) => commitNotify(e.target.value)}
              placeholder="you@example.com, colleague@example.com"
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">
              Comma- or newline-separated. Invalid emails are ignored on save.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reply-to (optional)</Label>
            <Input
              value={settings.replyToEmail ?? ""}
              onChange={(e) => update({ replyToEmail: e.target.value })}
              placeholder="Defaults to the submitter's email if they gave one"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Auto-reply to submitter</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
              <input
                type="checkbox"
                checked={settings.autoReply?.enabled ?? false}
                onChange={(e) =>
                  update({
                    autoReply: {
                      subject: settings.autoReply?.subject ?? "Thanks for your response",
                      body: settings.autoReply?.body ?? "Thanks — we've received your submission and will be in touch soon.",
                      enabled: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              Enabled
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input
              value={settings.autoReply?.subject ?? ""}
              onChange={(e) =>
                update({
                  autoReply: {
                    enabled: settings.autoReply?.enabled ?? false,
                    body: settings.autoReply?.body ?? "",
                    subject: e.target.value,
                  },
                })
              }
              placeholder="Thanks for your response"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Body</Label>
            <Textarea
              value={settings.autoReply?.body ?? ""}
              onChange={(e) =>
                update({
                  autoReply: {
                    enabled: settings.autoReply?.enabled ?? false,
                    subject: settings.autoReply?.subject ?? "",
                    body: e.target.value,
                  },
                })
              }
              rows={6}
              placeholder={`Hi {{submitterName}},\n\nThanks for completing {{formTitle}}. We'll be in touch soon.`}
            />
            <p className="text-[11px] text-muted-foreground">
              Tokens: <code className="rounded bg-muted px-1 py-0.5">{"{{formTitle}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{submitterName}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{submitterEmail}}"}</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
