"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export interface CourseCopyDraft {
  tagline: string;
  shortDescription: string;
  description: string;
  audience: string;
  audienceFor: string;
  features: string[];
}

/**
 * "Write it for me" — the OT types a few plain lines about the course and
 * this fills in the storefront copy from them.
 *
 * The draft is dropped into the normal form fields rather than saved, so
 * nothing reaches the public site until she reads it, edits whatever she
 * wants and presses Save. That matters: it's sales copy for a paid product.
 */
export function CopyAssist({
  courseId,
  notes,
  onNotesChange,
  onApply,
}: {
  courseId: string;
  notes: string;
  onNotesChange: (v: string) => void;
  onApply: (draft: CourseCopyDraft) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function draft() {
    setBusy(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch(`/api/courses/${courseId}/draft-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        draft?: CourseCopyDraft;
        error?: string;
      };
      if (!res.ok || !json.draft) {
        throw new Error(json.error ?? "Couldn't write the draft.");
      }
      onApply(json.draft);
      setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-6">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4 text-primary" />
        Write the course page for me
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Write a few lines below in your own words — what the session covers, who
        it&apos;s for, anything a parent would want to know. Press the button and
        it fills in the tagline, blurb, description, who-it&apos;s-for and the
        &ldquo;what&apos;s covered&rdquo; points underneath. <strong>Nothing is
        published</strong>{" "}— read it, change anything you like, then Save.
      </p>

      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={5}
        placeholder="e.g. An hour-long webinar for parents of children starting school. Covers getting dressed, lunchboxes, toileting at school, and settling the morning routine. Recorded live in July with a Q&A at the end."
        className="mt-3 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={draft}
          disabled={busy || notes.trim().length < 15}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {busy ? "Writing…" : "Write it for me"}
        </button>
        {notes.trim().length < 15 && !busy && (
          <span className="text-xs text-muted-foreground">
            Write a couple of lines first.
          </span>
        )}
      </div>

      {applied && (
        <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
          Done — the fields below have been filled in. Have a read, change
          anything that doesn&apos;t sound like you, then press{" "}
          <strong>Save changes</strong>{" "}at the bottom.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        It only uses what you wrote above — it won&apos;t invent claims about
        what the course achieves.
      </p>
    </section>
  );
}
