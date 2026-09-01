"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, School, Stamp } from "lucide-react";

/**
 * "New letter" — pick a starting point, then drop into the editor.
 *
 * Grace asked for a blank template kept alongside reports, plus the two
 * letter types she writes most (school summaries, statutory-assessment
 * support). Each option POSTs to /api/letters with a template key and
 * redirects into the editor. An optional ?clientId= pre-links the child.
 */
const OPTIONS = [
  {
    key: "blank",
    icon: FileText,
    title: "Blank letter",
    blurb: "Start from nothing — just the letterhead. Write it your way.",
  },
  {
    key: "school-summary",
    icon: School,
    title: "School summary & recommendations",
    blurb:
      "A summary of how a child is getting on, with strategies for school. Headings and prompts ready to fill in.",
  },
  {
    key: "statutory-assessment",
    icon: Stamp,
    title: "Statutory assessment support",
    blurb:
      "A letter supporting a request for statutory assessment. Structured with the usual sections.",
  },
];

function NewLetterInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(template: string) {
    if (busy) return;
    setBusy(template);
    setError(null);
    try {
      const res = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, ...(clientId ? { clientId } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (data.id) {
        window.location.replace(`/reports/letters/${data.id}?edit=1`);
      } else {
        setError(data.error ?? "Could not create the letter.");
        setBusy(null);
      }
    } catch {
      setError("Could not create the letter.");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/reports/letters"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Letters
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New letter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a starting point. You can change everything once you&apos;re in.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => create(o.key)}
              disabled={!!busy}
              className="flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-sm)] transition hover:border-primary disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {busy === o.key ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{o.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {o.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Templates are just starting points — the clinical content is always
        yours to write. Everything is confidential and branded with the
        Sensory Submarine letterhead when you print or email it.
      </p>
    </div>
  );
}

export default function NewLetterPage() {
  return (
    <Suspense fallback={null}>
      <NewLetterInner />
    </Suspense>
  );
}
