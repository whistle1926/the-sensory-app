"use client";

import { useEffect, useId, useState } from "react";
import {
  HelpCircle,
  X,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  List,
  Check,
} from "lucide-react";
import { getPageHelp, stepParts } from "@/lib/page-help";

/**
 * PageHelp — the "?" guide beside a page title.
 *
 * Deliberately a FLOATING, STICKY panel rather than a popover: Grace asked
 * to "keep it open while testing the steps" (2026-07-17). So it docks to
 * the bottom-right, never closes on outside-click, and doesn't trap focus
 * or block the page — you can click around and follow along. Only the X
 * (or Esc) closes it.
 *
 * Two modes:
 *   • Steps  — one step at a time with Back/Next (the "slideshow"), so you
 *              can do a step, then advance.
 *   • All    — the whole list at a glance.
 * Content comes from the central `page-help` registry.
 */
export function PageHelp({ pageKey }: { pageKey: string }) {
  const content = getPageHelp(pageKey);
  const [open, setOpen] = useState(false);
  // Opens on the full list — Grace's preference (2026-07-17): see every
  // step at a glance, rather than being walked through one at a time.
  // The ☰ toggle switches to the guided step-by-step view.
  const [showAll, setShowAll] = useState(true);
  const [step, setStep] = useState(0);
  // In list view, the step whose element is currently highlighted (click a
  // step to point it out). null = nothing highlighted.
  const [listFocus, setListFocus] = useState<number | null>(null);
  const panelId = useId();

  // Esc closes. No outside-click handler on purpose — clicking the page is
  // the whole point while the guide is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Highlight the element the current step is describing, and bring it into
  // view. Cleans up whenever the step changes / the guide closes, so only
  // one thing is ever ringed. A missing element (wrong tab open, renamed
  // selector) simply means no highlight — never a broken guide.
  // Which step drives the highlight: the clicked one in list view, or the
  // current one when stepping through.
  const activeIndex = showAll ? listFocus : step;
  const activeTarget =
    open && content && activeIndex !== null
      ? stepParts(content.steps[activeIndex] ?? "").target
      : undefined;

  useEffect(() => {
    if (!activeTarget) return;
    const el = document.querySelector(activeTarget);
    if (!el) return;
    el.classList.add("help-highlight");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return () => el.classList.remove("help-highlight");
  }, [activeTarget]);

  // Belt and braces: if the panel unmounts mid-step, drop any stray ring.
  useEffect(() => {
    return () => {
      document
        .querySelectorAll(".help-highlight")
        .forEach((el) => el.classList.remove("help-highlight"));
    };
  }, []);

  if (!content) return null;

  const total = content.steps.length;
  const isLast = step >= total - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`How to use this page: ${content.title}`}
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          open
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-primary"
        }`}
        title="How to use this page"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          id={panelId}
          role="complementary"
          aria-label={content.title}
          // Fixed + sticky so it survives scrolling and stays out of the
          // way. Full-width sheet on mobile, docked card on desktop.
          className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[23rem]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HelpCircle className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold leading-tight">
                  {content.title}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Stays open while you try it
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowAll((v) => !v);
                  setListFocus(null); // don't carry a ring across modes
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={showAll ? "Walk me through it" : "Show all steps"}
                aria-label={showAll ? "Walk me through it" : "Show all steps"}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setListFocus(null);
                }}
                aria-label="Close help"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-3.5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {content.summary}
            </p>

            {showAll ? (
              <>
              <ol className="mt-3 space-y-1">
                {content.steps.map((s, i) => {
                  const { text, target } = stepParts(s);
                  const focused = listFocus === i;
                  return (
                    <li key={i}>
                      {/* Clicking a step points it out on the page. Steps
                          without a target aren't clickable — nothing to
                          show — so they render as plain text. */}
                      <button
                        type="button"
                        disabled={!target}
                        onClick={() => setListFocus(focused ? null : i)}
                        title={target ? "Show me where" : undefined}
                        className={`flex w-full gap-2.5 rounded-lg p-1.5 text-left text-xs leading-relaxed transition-colors ${
                          focused
                            ? "bg-primary/10"
                            : target
                              ? "hover:bg-muted"
                              : "cursor-default"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            focused
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{text}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tap a step to point it out on the page.
              </p>
              </>
            ) : (
              <div className="mt-3">
                <div className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {step + 1}
                  </span>
                  <p className="pt-0.5 text-sm leading-relaxed">
                    {stepParts(content.steps[step]).text}
                  </p>
                </div>
                {activeTarget && (
                  <p className="mt-2 pl-8 text-[11px] text-primary">
                    Highlighted on the page for you
                  </p>
                )}

                {/* Progress dots — jump straight to any step. */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {content.steps.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStep(i)}
                      aria-label={`Step ${i + 1}`}
                      aria-current={i === step}
                      className={`h-1.5 rounded-full transition-all ${
                        i === step
                          ? "w-5 bg-primary"
                          : i < step
                            ? "w-1.5 bg-primary/40"
                            : "w-1.5 bg-muted-foreground/25"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {content.tips && content.tips.length > 0 && (showAll || isLast) && (
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

          {!showAll && (
            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                Step {step + 1} of {total}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 enabled:hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
