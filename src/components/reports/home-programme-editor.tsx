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
import {
  BookOpen,
  FileStack,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { sanitiseProgrammeSections } from "@/lib/programme-sections";
import { VoiceNotesRecorder } from "@/components/reports/voice-notes-recorder";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

/** Escape text for safe inclusion in the HTML body. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Append an HTML block to the existing HTML body. */
function appendBlock(existing: string, block: string): string {
  const trimmed = (existing || "").trim();
  return trimmed ? `${trimmed}${block}` : block;
}

/**
 * Format a programme template as HTML (heading, bullet lists, and the
 * step-by-step demo photos inline). Uses the shared
 * sanitiseProgrammeSections so both item shapes carry across: legacy
 * plain strings AND object items ({ text, demoSteps?, videoUrl? }).
 */
function formatTemplate(t: ProgrammeTemplate): string {
  const sections = sanitiseProgrammeSections(t.sections);
  let out = `<p><strong>${esc(t.title)}</strong></p>`;
  for (const s of sections) {
    if (s.title) out += `<p><strong>${esc(s.title)}</strong></p>`;
    // Items without photos group into one bullet list; an item WITH
    // demo photos renders as a line + caption + image so the picture
    // sits right under the step it illustrates.
    let listOpen = false;
    for (const i of s.items) {
      const demos = i.demoSteps ?? [];
      if (demos.length === 0) {
        if (!listOpen) {
          out += "<ul>";
          listOpen = true;
        }
        out += `<li>${esc(i.text)}</li>`;
      } else {
        if (listOpen) {
          out += "</ul>";
          listOpen = false;
        }
        out += `<p>${esc(i.text)}</p>`;
        for (const step of demos) {
          if (step.caption) out += `<p><em>${esc(step.caption)}</em></p>`;
          if (step.imageUrl)
            out += `<p><img src="${esc(step.imageUrl)}" alt="Demo step" style="max-width:320px;border-radius:8px;" /></p>`;
        }
      }
    }
    if (listOpen) out += "</ul>";
  }
  return out;
}

/** Format a single activity as an HTML paragraph. */
function formatActivity(a: Activity): string {
  const desc = a.description?.trim();
  return desc
    ? `<p>${esc(a.name)} — ${esc(desc)}</p>`
    : `<p>${esc(a.name)}</p>`;
}

/**
 * Format a leaflet reference as an HTML block (title + optional
 * description + a clickable link for file/link leaflets) so it travels
 * with the programme into the email and PDF.
 */
function formatLeaflet(l: Leaflet): string {
  let out = `<p>📄 <strong>Leaflet:</strong> ${esc(l.title)}</p>`;
  const desc = l.description?.trim();
  if (desc) out += `<p>${esc(desc)}</p>`;
  if ((l.kind === "file" || l.kind === "link") && l.fileUrl) {
    out += `<p><a href="${esc(l.fileUrl)}">${esc(l.fileUrl)}</a></p>`;
  }
  return out;
}

export function HomeProgrammeEditor({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<ProgrammeTemplate[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leaflets, setLeaflets] = useState<Leaflet[]>([]);

  // ── Tidy with AI ────────────────────────────────────────────────
  // Same idea as the report tidy: send the in-flight body, review the
  // result side-by-side, and only apply on approval. Nothing is saved
  // until the therapist hits Save as usual.
  const [tidying, setTidying] = useState(false);
  const [tidyResult, setTidyResult] = useState<string | null>(null);
  const [tidyError, setTidyError] = useState("");

  async function handleTidy() {
    setTidyError("");
    setTidying(true);
    try {
      const res = await fetch("/api/home-programmes/tidy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: value }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        html?: string;
        error?: string;
      };
      if (!res.ok || !data.html) {
        setTidyError(data.error ?? "Couldn't tidy the programme. Please try again.");
        return;
      }
      setTidyResult(data.html);
    } catch {
      setTidyError("Network error — please try again.");
    } finally {
      setTidying(false);
    }
  }

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
        {/* Tidy with AI — same as the report editor: cleans up dumped
            notes (grammar/tone only), reviewed before it's applied. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTidy}
          disabled={tidying || !value.trim()}
          title={
            value.trim()
              ? "Clean up the writing with AI — you review before it's applied"
              : "Write or dictate some notes first"
          }
          className="rounded-xl"
        >
          {tidying ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          {tidying ? "Tidying…" : "Tidy with AI"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Inserts append to the bottom — edit, format and reorder freely. Use
          the toolbar to <strong>bold</strong> or underline titles. Demo photos
          come through and show in the PDF &amp; email.
        </span>
      </div>

      {/* Voice dictation — speak an intro paragraph or a few lines; the
          transcript appends as a paragraph. Same recorder used for
          session notes (html mode so it fits the rich-text body). */}
      <VoiceNotesRecorder value={value} onChange={onChange} mode="html" />

      {/* Rich-text editor — bold, underline, headings, bullet/number lists. */}
      {tidyError && (
        <p className="text-xs text-red-600 dark:text-red-400">{tidyError}</p>
      )}

      <RichTextEditor
        value={value}
        onChange={onChange}
        minHeight={240}
        placeholder="Write the home programme… use the toolbar to bold or underline titles."
      />

      {/* Review the tidy before it replaces anything. */}
      <Dialog
        open={tidyResult !== null}
        onOpenChange={(o) => !o && setTidyResult(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review the tidied programme</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Grammar and tone only — the activities, instructions, numbers and
            links are unchanged. Nothing is saved until you apply this and hit
            Save.
          </p>
          <div className="grid max-h-[55vh] gap-4 overflow-y-auto sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Before
              </p>
              <div
                className="prose prose-sm max-w-none rounded-xl border border-border bg-muted/30 p-3 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                After
              </p>
              <div
                className="prose prose-sm max-w-none rounded-xl border-2 border-primary/40 bg-background p-3 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: tidyResult ?? "" }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              onClick={() => setTidyResult(null)}
              className="rounded-xl"
            >
              Keep mine
            </Button>
            <Button
              onClick={() => {
                if (tidyResult) onChange(tidyResult);
                setTidyResult(null);
              }}
              className="rounded-xl"
            >
              Use tidied version
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
