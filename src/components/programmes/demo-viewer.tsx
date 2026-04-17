"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DemoStep } from "@/lib/programme-sections";

interface Props {
  open: boolean;
  onClose: () => void;
  exerciseTitle: string;
  steps: DemoStep[];
}

/**
 * Parent-facing viewer for an exercise's illustrated demo cards. Keyboard
 * ←/→ navigates, Escape closes. Clicking the backdrop also closes.
 *
 * Kept intentionally dependency-free — just a fixed-position overlay + a
 * horizontal card stack. No animation library needed.
 */
export function DemoViewer({ open, onClose, exerciseTitle, steps }: Props) {
  const [index, setIndex] = useState(0);

  // Reset to first card whenever a new demo is opened.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, next, prev]);

  if (!open || steps.length === 0) return null;

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Demo for ${exerciseTitle}`}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Step {index + 1} of {steps.length}
            </p>
            <p className="truncate font-semibold" title={exerciseTitle}>
              {exerciseTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image + caption */}
        <div className="bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.imageUrl}
            alt={step.caption}
            className="aspect-square w-full object-contain"
          />
        </div>
        <p className="px-5 py-4 text-center font-medium">{step.caption}</p>

        {/* Nav */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={prev}
            disabled={isFirst}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={isLast ? onClose : next}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
