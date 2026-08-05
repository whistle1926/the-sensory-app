"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Rocket, Undo2 } from "lucide-react";
import { FIELD_LABELS, type DraftField } from "@/lib/course-draft";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Autosave + Publish, pinned to the bottom of the course editor.
 *
 * Typing saves to a draft after a short pause; the live page is untouched
 * until Publish is pressed. That separation is the whole point — an OT can
 * rewrite a course that's currently on sale without a parent seeing a
 * half-written sentence.
 *
 * The bar states plainly what's unpublished rather than just showing a dot,
 * so it's obvious whether the work is live or still sitting in a draft.
 */
export function PublishBar({
  courseId,
  draft,
  onPublished,
  onDiscarded,
}: {
  courseId: string;
  /** Current editor state — the fields that go through draft → publish. */
  draft: Record<string, unknown>;
  onPublished: () => void;
  onDiscarded: () => void;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [pending, setPending] = useState<DraftField[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef<string>("");
  // Skip the save that would otherwise fire from the initial render.
  const primed = useRef(false);

  useEffect(() => {
    const body = JSON.stringify(draft);
    if (!primed.current) {
      primed.current = true;
      lastSent.current = body;
      return;
    }
    if (body === lastSent.current) return;

    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft }),
        });
        if (!res.ok) throw new Error("save failed");
        const json = (await res.json()) as { pending?: DraftField[] };
        lastSent.current = body;
        setPending(json.pending ?? []);
        setState("saved");
      } catch {
        setState("error");
      }
    }, 900);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, courseId]);

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Publish failed");
      setPending([]);
      setState("idle");
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  async function discard() {
    if (
      !confirm(
        "Throw away your unpublished changes and go back to what's live? This can't be undone.",
      )
    )
      return;
    setPublishing(true);
    try {
      await fetch(`/api/courses/${courseId}/draft`, { method: "DELETE" });
      setPending([]);
      setState("idle");
      onDiscarded();
    } finally {
      setPublishing(false);
    }
  }

  const hasPending = pending.length > 0;

  return (
    <div className="sticky bottom-4 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <span className="inline-flex items-center gap-1.5 text-xs">
        {state === "saving" && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Saving…</span>
          </>
        )}
        {state === "saved" && (
          <>
            <Check className="h-3.5 w-3.5 text-green-600" />
            <span className="text-muted-foreground">All changes saved</span>
          </>
        )}
        {state === "error" && (
          <span className="font-semibold text-red-600">Couldn&apos;t save</span>
        )}
        {state === "idle" && !hasPending && (
          <span className="text-muted-foreground">Up to date with the live page</span>
        )}
      </span>

      {hasPending && (
        <span
          className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          title={pending.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
        >
          {pending.length} unpublished{" "}
          {pending.length === 1 ? "change" : "changes"}
        </span>
      )}

      {hasPending && (
        <button
          type="button"
          onClick={discard}
          disabled={publishing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Discard
        </button>
      )}

      <button
        type="button"
        onClick={publish}
        disabled={publishing || !hasPending}
        className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-green-600"
        title={hasPending ? "Make these changes visible to parents" : "Nothing to publish"}
      >
        {publishing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        Publish
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
