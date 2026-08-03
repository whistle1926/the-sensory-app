"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import type { ReviewGuideStep } from "@/lib/review-guide";

/**
 * "How to check this update" — a numbered, visual walkthrough shown on a task
 * that's ready for review.
 *
 * Deliberately large and plain-spoken: the readers are Grace and Claire, not
 * developers. Screenshots are clickable to open full size, and each step can
 * carry a direct link so they don't have to hunt for the page.
 */
export function ReviewGuide({ steps }: { steps: ReviewGuideStep[] }) {
  const [open, setOpen] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (steps.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/[0.03] shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </span>
          <span>
            <span className="block text-base font-bold">
              How to check this update
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {steps.length} step{steps.length === 1 ? "" : "s"} — have a look
              and tell us if it&apos;s how you wanted it
            </span>
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <ol className="space-y-5 border-t border-primary/20 p-5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {s.title && (
                  <p className="text-sm font-bold sm:text-base">{s.title}</p>
                )}
                {s.caption && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {s.caption}
                  </p>
                )}

                {s.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox(s.imageUrl)}
                    className="mt-3 block w-full overflow-hidden rounded-xl border border-border bg-background transition hover:border-primary/50"
                    title="Click to view full size"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt={s.title || `Step ${i + 1}`}
                      className="w-full object-cover"
                    />
                  </button>
                )}

                {s.href && (
                  <a
                    href={s.href}
                    target={s.href.startsWith("/") ? undefined : "_blank"}
                    rel={s.href.startsWith("/") ? undefined : "noopener noreferrer"}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    {s.hrefLabel}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Full-size screenshot viewer */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
