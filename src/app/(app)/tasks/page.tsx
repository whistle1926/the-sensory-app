"use client";

/**
 * Tasks — "Build Updates" home base.
 *
 * Patrick uses this as a tester's notebook: each task is a feature card,
 * and the four feedback chips (Works / Issue / Suggestion / Confused)
 * let him leave a quick note that lands in the DB. Claude reads back the
 * "Has feedback" filter to pick up the next thing to fix.
 *
 * Replaces the older "kanban + notes" UI — the data model is the same
 * (Task + TaskFeedback rows on top), so existing tasks survive intact.
 */
import { useEffect, useMemo, useState } from "react";
import { Fragment, type ReactNode } from "react";
import {
  CheckCircle2,
  HandMetal,
  HelpCircle,
  Lightbulb,
  Loader2,
  Plus,
  Search,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";

type Kind = "works" | "issue" | "suggestion" | "confused";

interface Feedback {
  id: string;
  kind: Kind;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: string;
  feedback: Feedback[];
  updatedAt: string;
}

type FilterKey =
  | "all"
  | "shipped"
  | "partial"
  | "setup"
  | "feedback";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shipped", label: "Shipped" },
  { key: "partial", label: "Partial" },
  { key: "setup", label: "Setup required" },
  { key: "feedback", label: "Has feedback" },
];

const KIND_META: Record<
  Kind,
  { label: string; icon: typeof ThumbsUp; tone: string }
> = {
  works: { label: "Works", icon: ThumbsUp, tone: "text-green-700 bg-green-100 dark:bg-green-950/30 dark:text-green-300" },
  issue: { label: "Issue", icon: HandMetal, tone: "text-amber-700 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300" },
  suggestion: { label: "Suggestion", icon: Lightbulb, tone: "text-blue-700 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300" },
  confused: { label: "Confused", icon: HelpCircle, tone: "text-purple-700 bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300" },
};

const STATUS_BADGE: Record<
  TaskRow["status"],
  { label: string; tone: string }
> = {
  done: {
    label: "SHIPPED",
    tone: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  },
  in_progress: {
    label: "PARTIAL",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  todo: {
    label: "SETUP REQUIRED",
    tone: "bg-muted text-muted-foreground",
  },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    const res = await fetch("/api/tasks");
    const data = (await res.json()) as TaskRow[];
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const counts = useMemo(() => {
    const live = tasks.filter((t) => t.status === "done").length;
    const partial = tasks.filter((t) => t.status === "in_progress").length;
    const open = tasks
      .flatMap((t) => t.feedback)
      .filter((f) => !f.resolvedAt).length;
    return { live, partial, open };
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "shipped") list = list.filter((t) => t.status === "done");
    else if (filter === "partial")
      list = list.filter((t) => t.status === "in_progress");
    else if (filter === "setup")
      list = list.filter((t) => t.status === "todo");
    else if (filter === "feedback")
      list = list.filter((t) => t.feedback.some((f) => !f.resolvedAt));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [tasks, filter, search]);

  return (
    <div className="space-y-6">
      {/* ---- Header card with stats + Add Task ---- */}
      <div
        className="rounded-3xl border border-border p-6 shadow-[var(--shadow-sm)]"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 8%, var(--background)), color-mix(in oklab, var(--primary) 3%, var(--background)))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Build Updates &middot; Testers&rsquo; home base
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every recently-shipped feature lives here. Click the title to
              jump into it (a new tab opens so this page stays put), follow
              the test steps, then leave a quick chip — 👍 Works · ✋ Issue ·
              💡 Suggestion · ❓ Confused. Optional message attached. Your
              feedback lands in the DB and Claude can pull it as a batch
              when picking the next thing to fix.
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <Stat number={counts.live} label="Features live" />
              <Stat number={counts.partial} label="Partial / in flight" />
              <Stat number={counts.open} label="Open feedback items" />
            </div>
          </div>
          <Button
            onClick={() => setShowNew(true)}
            className="rounded-xl shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* ---- Filter pills + search ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                filter === f.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features…"
            className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* ---- Feature cards ---- */}
      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading features…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm font-semibold">No features match this filter.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try “All”, or click Add Task to log a new request.
          </p>
        </div>
      ) : (
        filtered.map((t, i) => (
          <FeatureCard
            key={t.id}
            index={i + 1}
            task={t}
            onChange={refresh}
          />
        ))
      )}

      <NewTaskDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={() => {
          setShowNew(false);
          refresh();
        }}
      />
    </div>
  );
}

// Bare-URL detector. Tight bounds so we don't grab trailing punctuation
// (e.g. "https://example.com.") into the link.
const URL_REGEX = /\bhttps?:\/\/[^\s<>"')]+/g;

/**
 * Auto-linkify a chunk of HTML — wraps bare http(s) URLs in anchor tags
 * but skips text already inside an <a>...</a> block. Used on task
 * descriptions, which are stored as raw HTML and historically were
 * typed in with bare URLs that didn't render as links.
 */
function autoLinkifyHtml(html: string): string {
  // Split on existing <a>...</a> blocks. Even indices are outside-link
  // text we want to scan; odd indices are existing anchors we leave
  // untouched.
  const parts = html.split(/(<a[\s\S]*?<\/a>)/gi);
  return parts
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk;
      return chunk.replace(
        URL_REGEX,
        (url) =>
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">${url}</a>`,
      );
    })
    .join("");
}

/**
 * Render plain text with bare URLs as clickable links. React-native
 * version of the helper above — used for the feedback notes which are
 * rendered as text rather than HTML.
 */
function linkifyText(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a
        key={m.index}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline"
      >
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}

function Stat({ number, label }: { number: number; label: string }) {
  return (
    <div>
      <span className="text-3xl font-bold tracking-tight">{number}</span>
      <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function FeatureCard({
  task,
  index,
  onChange,
}: {
  task: TaskRow;
  index: number;
  onChange: () => void;
}) {
  const [open, setOpen] = useState<Kind | null>(null);

  const status = STATUS_BADGE[task.status];
  const unresolved = task.feedback.filter((f) => !f.resolvedAt);
  const resolved = task.feedback.filter((f) => f.resolvedAt);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-xs font-mono text-muted-foreground">
          #{index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{task.title}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider",
                status.tone,
              )}
            >
              {status.label}
            </span>
            {unresolved.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary">
                {unresolved.length} OPEN
              </span>
            )}
          </div>
          {task.description && (
            <div
              className="prose prose-sm mt-2 max-w-none text-sm text-muted-foreground prose-p:my-1.5 prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: autoLinkifyHtml(task.description),
              }}
            />
          )}
        </div>
      </div>

      {/* Quick-feedback row */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="text-xs font-medium text-muted-foreground">
          Quick feedback:
        </span>
        {(Object.keys(KIND_META) as Kind[]).map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setOpen(open === kind ? null : kind)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                meta.tone,
                open === kind && "ring-2 ring-foreground/30",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {open && (
        <FeedbackComposer
          taskId={task.id}
          kind={open}
          onClose={() => setOpen(null)}
          onSubmitted={() => {
            setOpen(null);
            onChange();
          }}
        />
      )}

      {/* Existing feedback */}
      {(unresolved.length > 0 || resolved.length > 0) && (
        <div className="mt-4 space-y-2">
          {unresolved.map((f) => (
            <FeedbackRow key={f.id} taskId={task.id} f={f} onChange={onChange} />
          ))}
          {resolved.map((f) => (
            <FeedbackRow key={f.id} taskId={task.id} f={f} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackComposer({
  taskId,
  kind,
  onClose,
  onSubmitted,
}: {
  taskId: string;
  kind: Kind;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = KIND_META[kind];

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message: message.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            meta.tone,
          )}
        >
          <meta.icon className="h-3 w-3" />
          {meta.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional note — what worked, what didn't, what to change…"
        rows={3}
        className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg"
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={submitting}
          className="rounded-lg"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save feedback
        </Button>
      </div>
    </div>
  );
}

function FeedbackRow({
  taskId,
  f,
  onChange,
}: {
  taskId: string;
  f: Feedback;
  onChange: () => void;
}) {
  const meta = KIND_META[f.kind];
  const Icon = meta.icon;
  const [busy, setBusy] = useState<"resolve" | "delete" | null>(null);

  async function toggleResolved() {
    setBusy("resolve");
    await fetch(`/api/tasks/${taskId}/feedback/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !f.resolvedAt }),
    });
    setBusy(null);
    onChange();
  }

  async function remove() {
    if (!confirm("Delete this feedback note?")) return;
    setBusy("delete");
    await fetch(`/api/tasks/${taskId}/feedback/${f.id}`, { method: "DELETE" });
    setBusy(null);
    onChange();
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border p-3 text-sm",
        f.resolvedAt ? "bg-muted/30 opacity-60" : "bg-card",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider shrink-0 mt-0.5",
          meta.tone,
        )}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
      <div className="min-w-0 flex-1">
        {f.message ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {linkifyText(f.message)}
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">No note.</p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {new Date(f.createdAt).toLocaleString("en-GB")}
          {f.resolvedAt && (
            <span className="ml-2 inline-flex items-center gap-1 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Resolved
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleResolved}
          disabled={busy !== null}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          title={f.resolvedAt ? "Reopen" : "Mark resolved"}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
