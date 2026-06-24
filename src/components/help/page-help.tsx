"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle, X, Lightbulb } from "lucide-react";
import { getPageHelp } from "@/lib/page-help";

/**
 * PageHelp — a small "?" icon shown next to a page title. Clicking it
 * opens a short, friendly guide for that page, read from the central
 * `page-help` registry (so guidance stays in one maintainable place).
 *
 * Self-contained popover: opens on click, closes on outside-click or Esc.
 * Renders nothing if the pageKey has no registered content, so it's safe
 * to drop in anywhere.
 */
export function PageHelp({ pageKey }: { pageKey: string }) {
  const content = getPageHelp(pageKey);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!content) return null;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`How to use this page: ${content.title}`}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        title="How to use this page"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={content.title}
          className="absolute left-0 top-8 z-50 w-[min(92vw,22rem)] rounded-2xl border border-border bg-card p-4 text-left shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HelpCircle className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold">{content.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {content.summary}
          </p>

          <ol className="mt-3 space-y-2">
            {content.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          {content.tips && content.tips.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-xl bg-muted/50 p-3">
              {content.tips.map((tip, i) => (
                <p
                  key={i}
                  className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground"
                >
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>{tip}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
