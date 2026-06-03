"use client";

/**
 * Home Programme editor — used inside the report viewer's "Home
 * Programme Suggestions" section when the report is in edit mode.
 *
 * Above the plain-text editor sits three pickers:
 *   - Insert template — pulls from /programmes (ProgrammeTemplate
 *     library). Picking one expands its sections into a formatted
 *     plain-text block and appends to the field.
 *   - Insert activity — pulls from /activities (Activity bank).
 *     Picking one appends a single line: "- Name — description".
 *   - Insert leaflet — pulls from /leaflets (Leaflet library).
 *     Picking one appends a referenced block: title + optional
 *     description + URL (for file/link kinds), so the leaflet
 *     travels with the report when it's emailed to the parent.
 *
 * Patrick can then edit inline to personalise per client. Keeping the
 * data in plain text means the existing email/PDF/DOCX exports keep
 * working without changes.
 */
import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileStack, Plus, Search } from "lucide-react";

interface ProgrammeTemplate {
  id: string;
  title: string;
  description: string;
  sections: unknown; // [{ title, items: [...] }] — sanitised at use
}

interface Activity {
  id: string;
  name: string;
  description: string;
  category?: string;
}

interface Leaflet {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  kind: "content" | "file" | "link" | string;
  // Present for kind === "file" or "link". Absent for authored "content".
  fileUrl: string | null;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
}

/** Append `block` to `existing` with a blank line between (unless empty). */
function appendBlock(existing: string, block: string): string {
  const trimmed = existing.trimEnd();
  if (!trimmed) return block;
  return `${trimmed}\n\n${block}`;
}

/** Coerce ProgrammeTemplate.sections (JSON) into a strict shape we can render. */
function readSections(
  raw: unknown,
): Array<{ title: string; items: string[] }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const obj = s as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title : "";
      const items = Array.isArray(obj.items)
        ? obj.items.filter((i): i is string => typeof i === "string")
        : [];
      return { title, items };
    })
    .filter((s): s is { title: string; items: string[] } => s !== null);
}

/** Format a template as plain text the way Patrick would type it. */
function formatTemplate(t: ProgrammeTemplate): string {
  const sections = readSections(t.sections);
  const head = `${t.title}`;
  const body = sections
    .map((s) => {
      const items = s.items.map((i) => `- ${i}`).join("\n");
      return s.title ? `${s.title}:\n${items}` : items;
    })
    .filter(Boolean)
    .join("\n\n");
  return body ? `${head}\n\n${body}` : head;
}

/** Format a single activity as a one-line bullet. */
function formatActivity(a: Activity): string {
  const desc = a.description?.trim();
  return desc ? `- ${a.name} — ${desc}` : `- ${a.name}`;
}

/**
 * Format a leaflet as a referenced block that travels with the
 * report. For file/link leaflets we include the URL so it remains
 * clickable in the emailed HTML and printable in the PDF. For
 * authored "content" leaflets we just reference the title — the
 * full body lives in the library, and the OT can paste it in
 * manually if they want the text inline.
 */
function formatLeaflet(l: Leaflet): string {
  const lines = [`📄 Leaflet: ${l.title}`];
  const desc = l.description?.trim();
  if (desc) lines.push(desc);
  if ((l.kind === "file" || l.kind === "link") && l.fileUrl) {
    lines.push(l.fileUrl);
  }
  return lines.join("\n");
}

export function HomeProgrammeEditor({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<ProgrammeTemplate[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leaflets, setLeaflets] = useState<Leaflet[]>([]);

  useEffect(() => {
    fetch("/api/programmes")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]));
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(() => setActivities([]));
    fetch("/api/leaflets")
      .then((r) => r.json())
      .then((data) => setLeaflets(Array.isArray(data) ? data : []))
      .catch(() => setLeaflets([]));
  }, []);

  // Auto-grow textarea (same heuristic as the report-viewer Prose
  // editor, so the home-programme field feels identical to the others).
  const rows = Math.max(6, value.split("\n").length + 1);

  return (
    <div className="space-y-3">
      {/* Insert pickers */}
      <div className="flex flex-wrap items-center gap-2">
        <TemplatePicker
          templates={templates}
          onPick={(t) => onChange(appendBlock(value, formatTemplate(t)))}
        />
        <ActivityPicker
          activities={activities}
          onPick={(a) => onChange(appendBlock(value, formatActivity(a)))}
        />
        <LeafletPicker
          leaflets={leaflets}
          onPick={(l) => onChange(appendBlock(value, formatLeaflet(l)))}
        />
        <span className="text-xs text-muted-foreground">
          Inserts append to the bottom — you can edit and reorder freely.
        </span>
      </div>

      {/* Plain textarea — identical styling to the other prose fields */}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template picker — searchable dropdown over /api/programmes         */
/* ------------------------------------------------------------------ */

function TemplatePicker({
  templates,
  onPick,
}: {
  templates: ProgrammeTemplate[];
  onPick: (t: ProgrammeTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return templates;
    const needle = q.toLowerCase();
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle),
    );
  }, [templates, q]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        disabled={templates.length === 0}
        title={
          templates.length === 0
            ? "No programme templates yet — add some in Programmes."
            : "Insert a programme template"
        }
      >
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        Insert template
        <Plus className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <div className="relative border-b border-border p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search templates…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  No templates match.
                </p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onPick(t);
                      setOpen(false);
                      setQ("");
                    }}
                    className="block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span className="block font-medium text-foreground">
                      {t.title}
                    </span>
                    {t.description && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                        {t.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity picker — searchable dropdown over /api/activities         */
/* ------------------------------------------------------------------ */

function ActivityPicker({
  activities,
  onPick,
}: {
  activities: Activity[];
  onPick: (a: Activity) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return activities;
    const needle = q.toLowerCase();
    return activities.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        (a.category ?? "").toLowerCase().includes(needle) ||
        a.description.toLowerCase().includes(needle),
    );
  }, [activities, q]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        disabled={activities.length === 0}
        title={
          activities.length === 0
            ? "No activities in the bank yet."
            : "Insert an activity from the bank"
        }
      >
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        Insert activity
        <Plus className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 z-50 mt-1 w-96 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <div className="relative border-b border-border p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, category, description…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  No activities match.
                </p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onPick(a);
                      setOpen(false);
                      setQ("");
                    }}
                    className="block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {a.name}
                      </span>
                      {a.category && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          {a.category}
                        </span>
                      )}
                    </span>
                    {a.description && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                        {a.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaflet picker — searchable dropdown over /api/leaflets            */
/* ------------------------------------------------------------------ */

function LeafletPicker({
  leaflets,
  onPick,
}: {
  leaflets: Leaflet[];
  onPick: (l: Leaflet) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return leaflets;
    const needle = q.toLowerCase();
    return leaflets.filter(
      (l) =>
        l.title.toLowerCase().includes(needle) ||
        (l.category ?? "").toLowerCase().includes(needle) ||
        (l.description ?? "").toLowerCase().includes(needle),
    );
  }, [leaflets, q]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        disabled={leaflets.length === 0}
        title={
          leaflets.length === 0
            ? "No leaflets in the library yet — add some in Leaflets."
            : "Insert a leaflet reference (title + link) so it travels with the report"
        }
      >
        <FileStack className="h-3.5 w-3.5 text-primary" />
        Insert leaflet
        <Plus className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 z-50 mt-1 w-96 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <div className="relative border-b border-border p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, category, description…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  No leaflets match.
                </p>
              ) : (
                filtered.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      onPick(l);
                      setOpen(false);
                      setQ("");
                    }}
                    className="block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {l.title}
                      </span>
                      {l.category && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          {l.category}
                        </span>
                      )}
                    </span>
                    {l.description && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                        {l.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
