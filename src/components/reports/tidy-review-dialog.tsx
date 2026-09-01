"use client";

/**
 * Side-by-side review after AI tidy.
 *
 * The OT clicked "Tidy with AI" while editing. We've already called
 * the tidy endpoint and have both the current draft + the tidied
 * version. This dialog shows the differences section-by-section so
 * the OT can review — and now EDIT — each cleaned-up "After" before
 * applying. "Apply all" applies whatever is in the After boxes (their
 * edits included) back onto the draft; nothing persists until they
 * Save on the report itself.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReportContent } from "@/types/report";

interface Diff {
  label: string;
  /** Dotted path so we know what changed if needed for analytics. */
  path: string;
  before: string;
  after: string;
}

/** Walk a few well-known string-bearing paths in ReportContent and
 *  collect (label, before, after) tuples where the strings differ. */
function collectDiffs(before: ReportContent, after: ReportContent): Diff[] {
  const out: Diff[] = [];
  const push = (label: string, path: string, b: string, a: string) => {
    if ((b ?? "") !== (a ?? "")) out.push({ label, path, before: b ?? "", after: a ?? "" });
  };

  push("Reason for Referral", "reasonForReferral", before.reasonForReferral, after.reasonForReferral);
  push("Session Overview", "sessionOverview", before.sessionOverview, after.sessionOverview);

  push("Observations · Sensory Responses", "observations.sensoryResponses", before.observations.sensoryResponses, after.observations.sensoryResponses);
  push("Observations · Engagement", "observations.engagementParticipation", before.observations.engagementParticipation, after.observations.engagementParticipation);
  push("Observations · Communication", "observations.communicationSocial", before.observations.communicationSocial, after.observations.communicationSocial);
  push("Observations · Regulation", "observations.emotionalRegulation", before.observations.emotionalRegulation, after.observations.emotionalRegulation);

  push("Findings · Sensory Processing", "assessmentFindings.sensoryProcessing", before.assessmentFindings.sensoryProcessing, after.assessmentFindings.sensoryProcessing);
  push("Findings · Fine Motor", "assessmentFindings.fineMotor", before.assessmentFindings.fineMotor, after.assessmentFindings.fineMotor);
  push("Findings · Gross Motor", "assessmentFindings.grossMotor", before.assessmentFindings.grossMotor, after.assessmentFindings.grossMotor);
  push("Findings · Self-Regulation", "assessmentFindings.selfRegulation", before.assessmentFindings.selfRegulation, after.assessmentFindings.selfRegulation);
  push("Findings · Play & Functional", "assessmentFindings.playFunctional", before.assessmentFindings.playFunctional, after.assessmentFindings.playFunctional);

  const bfr = before.functionalReview ?? {};
  const afr = after.functionalReview ?? {};
  push("Functional · Feeding", "functionalReview.feedingAndEating", bfr.feedingAndEating ?? "", afr.feedingAndEating ?? "");
  push("Functional · Personal Care", "functionalReview.personalCareAndDressing", bfr.personalCareAndDressing ?? "", afr.personalCareAndDressing ?? "");
  push("Functional · Toileting", "functionalReview.toileting", bfr.toileting ?? "", afr.toileting ?? "");
  push("Functional · Sleep", "functionalReview.sleep", bfr.sleep ?? "", afr.sleep ?? "");
  push("Functional · School", "functionalReview.school", bfr.school ?? "", afr.school ?? "");
  push("Functional · Other Concerns", "functionalReview.otherConcerns", bfr.otherConcerns ?? "", afr.otherConcerns ?? "");
  push("Functional · Parent Discussion", "functionalReview.discussionWithParent", bfr.discussionWithParent ?? "", afr.discussionWithParent ?? "");

  push("Clinical Impressions", "clinicalImpressions", before.clinicalImpressions, after.clinicalImpressions);
  push("Recommendations", "recommendations", before.recommendations, after.recommendations);

  push("Goals · Short-Term", "goals.shortTerm", before.goals.shortTerm, after.goals.shortTerm);
  push("Goals · Long-Term", "goals.longTerm", before.goals.longTerm, after.goals.longTerm);
  push("Goals · Next Session Plan", "goals.nextSessionPlan", before.goals.nextSessionPlan, after.goals.nextSessionPlan);

  push("Home Programme", "homeProgrammeSuggestions", before.homeProgrammeSuggestions, after.homeProgrammeSuggestions);

  return out;
}

/** Textarea that grows to fit its content, so long sections aren't cramped.
 *  Goes read-only once a section is approved (locked into the draft). */
function GrowTextarea({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      rows={2}
      className={
        "w-full resize-y rounded-lg border px-2.5 py-2 text-sm leading-relaxed outline-none transition-colors " +
        (readOnly
          ? "cursor-default border-green-500/30 bg-green-50/50 text-foreground/90 dark:bg-green-950/20"
          : "border-primary/20 bg-background text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20")
      }
    />
  );
}

interface Props {
  open: boolean;
  loading: boolean;
  error: string | null;
  before: ReportContent | null;
  after: ReportContent | null;
  /** Live-apply (or revert) ONE section straight into the draft. */
  onApplySection: (path: string, value: string) => void;
  /** Close the dialog — approved sections are already in the draft. */
  onClose: () => void;
}

export function TidyReviewDialog({
  open,
  loading,
  error,
  before,
  after,
  onApplySection,
  onClose,
}: Props) {
  // The section list is FROZEN when results arrive so that editing an
  // After box (even to match the Before) never makes a row vanish mid-edit.
  const [frozen, setFrozen] = useState<Diff[]>([]);
  // Editable After text per section, seeded from Claude's version.
  const [afters, setAfters] = useState<Record<string, string>>({});
  // Sections the OT has approved — these are LIVE in the draft already.
  const [approved, setApproved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setFrozen([]);
      setAfters({});
      setApproved(new Set());
      return;
    }
    if (before && after) {
      const diffs = collectDiffs(before, after);
      setFrozen(diffs);
      const seed: Record<string, string> = {};
      for (const d of diffs) seed[d.path] = d.after;
      setAfters(seed);
      setApproved(new Set());
    }
    // Re-seeds only when a NEW tidy result arrives (after/before identity
    // changes) or on open — NOT on edits, which touch local state only.
  }, [open, before, after]);

  /** Approve = write this section's (edited) After into the draft now. */
  function approveSection(d: Diff) {
    onApplySection(d.path, afters[d.path] ?? d.after);
    setApproved((prev) => new Set(prev).add(d.path));
  }

  /** Undo = revert this section in the draft back to the original wording.
   *  The edited After text is kept in the box so nothing typed is lost. */
  function undoSection(d: Diff) {
    onApplySection(d.path, d.before);
    setApproved((prev) => {
      const next = new Set(prev);
      next.delete(d.path);
      return next;
    });
  }

  const allApproved = frozen.length > 0 && approved.size === frozen.length;

  function approveAll() {
    for (const d of frozen) {
      if (!approved.has(d.path)) onApplySection(d.path, afters[d.path] ?? d.after);
    }
    setApproved(new Set(frozen.map((d) => d.path)));
  }

  function undoAll() {
    for (const d of frozen) {
      if (approved.has(d.path)) onApplySection(d.path, d.before);
    }
    setApproved(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-none !w-[96vw] sm:!w-[96vw] sm:!max-w-none max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI tidy — review changes</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Claude is tidying the report… (usually 25–40 seconds)
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <X className="mr-1 inline h-4 w-4" />
            {error}
          </div>
        ) : !before || !after ? null : frozen.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <p className="mt-3 text-sm font-semibold">Nothing to tidy.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Claude didn&apos;t find anything to clean up — your draft is good
              to save as-is.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {frozen.length} section{frozen.length === 1 ? "" : "s"} changed.
                Edit each <strong>After</strong> box if you want, then{" "}
                <strong>Approve</strong>{" "}it — the change drops straight into your
                report the moment you click. <strong>Undo</strong>{" "}any section to
                put it back. Nothing is permanently saved until you click{" "}
                <strong>Save</strong>{" "}back on the report.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {approved.size} / {frozen.length} applied
                </span>
                <button
                  type="button"
                  onClick={() => (allApproved ? undoAll() : approveAll())}
                  className="text-[11px] font-semibold text-primary underline hover:brightness-110"
                >
                  {allApproved ? "Undo all" : "Approve all"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {frozen.map((d) => {
                const isApproved = approved.has(d.path);
                const edited = (afters[d.path] ?? d.after) !== d.after;
                return (
                  <div
                    key={d.path}
                    className={
                      "overflow-hidden rounded-xl border transition-colors " +
                      (isApproved
                        ? "border-green-500/60 ring-1 ring-green-500/30"
                        : "border-border")
                    }
                  >
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
                      <span className="text-xs font-semibold">
                        {isApproved && (
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        )}
                        {d.label}
                      </span>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">
                            Applied to report
                          </span>
                          <button
                            type="button"
                            onClick={() => undoSection(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            Undo
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => approveSection(d)}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:brightness-110"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; apply
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-x sm:divide-y-0 divide-border">
                      <div className="p-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Before
                        </p>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/80">
                          {d.before || "(empty)"}
                        </pre>
                      </div>
                      <div className="bg-primary/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {isApproved ? "After — applied" : "After — editable"}
                          </p>
                          {!isApproved && edited && (
                            <button
                              type="button"
                              onClick={() =>
                                setAfters((prev) => ({
                                  ...prev,
                                  [d.path]: d.after,
                                }))
                              }
                              className="text-[10px] font-semibold text-muted-foreground underline hover:text-foreground"
                            >
                              Reset to AI version
                            </button>
                          )}
                        </div>
                        <GrowTextarea
                          value={afters[d.path] ?? d.after}
                          onChange={(v) =>
                            setAfters((prev) => ({ ...prev, [d.path]: v }))
                          }
                          readOnly={isApproved}
                        />
                        {isApproved && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground">
                            Locked in. Click <strong>Undo</strong>{" "}above to edit
                            this section again.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              undoAll();
              onClose();
            }}
            disabled={loading || approved.size === 0}
          >
            <X className="mr-2 h-4 w-4" />
            Undo all &amp; close
          </Button>
          <Button onClick={onClose} disabled={loading}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {approved.size > 0 ? `Done — ${approved.size} applied` : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
