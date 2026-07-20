"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Pencil, Save, Send, Sparkles, X, Loader2, Check } from "lucide-react";
import { TidyReviewDialog } from "@/components/reports/tidy-review-dialog";
import { ReportSummaryDialog } from "@/components/reports/report-summary-dialog";
import Link from "next/link";
import { ReportViewer } from "@/components/reports/report-viewer";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportContent } from "@/types/report";
import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar, Chip, Panel } from "@/components/ds";
import { Button } from "@/components/ui/button";

interface ReportData {
  id: string;
  status: string;
  content: ReportContent;
  client: {
    firstName: string;
    lastName: string;
    parentCarerEmail?: string;
  };
  reportDate: string;
}

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const searchParams = useSearchParams();
  // ?edit=1 (deep-link from elsewhere, e.g. the client page's
  // "Edit programme" CTA) auto-enters edit mode once the report
  // has loaded. The confirmation prompt for final reports still
  // fires inside startEdit().
  const wantsEdit = searchParams.get("edit") === "1";
  const { data: session } = useSession();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit-mode state. `draftContent` is the dirty copy of `report.content`
  // — we never touch the saved copy until the user clicks Save, so
  // Cancel can revert by simply dropping it.
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState<ReportContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ───────────── In-progress edit auto-save ─────────────
   * The report itself is already a saved draft in the DB, so a user can
   * always come back to it from the reports list. The risk we protect
   * against here is losing *unsaved edits*: while editing, `draftContent`
   * lives only in memory, so closing the tab before clicking Save would
   * throw the work away. We debounce-mirror the working copy into
   * localStorage (per report), offer to restore it when the user comes
   * back to edit, and warn before leaving with unsaved changes. Same
   * pattern as the New Report page so the experience is consistent. */
  const EDIT_DRAFT_KEY = `sensory:reportEditDraft:${reportId}:v1`;
  const [editSaveState, setEditSaveState] = useState<"idle" | "saving" | "saved">("idle");
  // Holds the timestamp of a recovered local draft so we can offer to
  // restore it. Null = nothing to restore.
  const [recoverableAt, setRecoverableAt] = useState<string | null>(null);
  // Guards the auto-save effect from firing on the initial seed of
  // draftContent (entering edit mode shouldn't count as an edit).
  const editHydrated = useRef(false);
  const editSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ───────────── Summary dialog state ───────────── */
  const [summaryOpen, setSummaryOpen] = useState(false);

  /* ───────────── AI tidy state ───────────── */
  const [tidyOpen, setTidyOpen] = useState(false);
  const [tidyLoading, setTidyLoading] = useState(false);
  const [tidyError, setTidyError] = useState<string | null>(null);
  const [tidyBefore, setTidyBefore] = useState<ReportContent | null>(null);
  const [tidyAfter, setTidyAfter] = useState<ReportContent | null>(null);

  async function runTidy() {
    if (!draftContent) return;
    setTidyOpen(true);
    setTidyLoading(true);
    setTidyError(null);
    setTidyBefore(JSON.parse(JSON.stringify(draftContent)));
    setTidyAfter(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/tidy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftContent }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Tidy failed (${res.status})`);
      }
      const { content } = (await res.json()) as { content: ReportContent };
      setTidyAfter(content);
    } catch (e) {
      setTidyError(e instanceof Error ? e.message : "Tidy failed");
    } finally {
      setTidyLoading(false);
    }
  }

  // Live-apply (or revert) ONE tidied section straight into the draft as the
  // OT approves it in the review dialog. Sets the value at a dotted path on a
  // clone of the current draft. Persistence still only happens on Save.
  function applyTidySection(path: string, value: string) {
    setDraftContent((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
      const keys = path.split(".");
      let node: Record<string, unknown> = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!node[k] || typeof node[k] !== "object") node[k] = {};
        node = node[k] as Record<string, unknown>;
      }
      node[keys[keys.length - 1]] = value;
      return next as unknown as ReportContent;
    });
  }
  function closeTidy() {
    setTidyOpen(false);
    setTidyAfter(null);
    setTidyBefore(null);
    setTidyError(null);
  }

  const isAdmin =
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "TEAM_MANAGER";

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
        // Honour ?edit=1 once on load. We seed draftContent here
        // directly to skip the "final report" confirm dialog when
        // the deep-link was clicked intentionally from the client
        // page — startEdit() shows that prompt and a deep-link
        // shouldn't be interrupted.
        if (wantsEdit && data?.content) {
          editHydrated.current = false;
          setDraftContent(JSON.parse(JSON.stringify(data.content)));
          setEditing(true);
          detectRecoverableDraft(data.content);
        }
      });
  }, [reportId, wantsEdit]);

  /* Auto-save the working copy to localStorage (debounced) while editing,
   * so unsaved edits survive an accidental tab close or navigation. */
  useEffect(() => {
    if (!editing || !draftContent) return;
    // Skip the very first run, which is just the initial seed.
    if (!editHydrated.current) {
      editHydrated.current = true;
      return;
    }
    setEditSaveState("saving");
    if (editSaveTimer.current) clearTimeout(editSaveTimer.current);
    editSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          EDIT_DRAFT_KEY,
          JSON.stringify({ content: draftContent, savedAt: new Date().toISOString() }),
        );
        setEditSaveState("saved");
      } catch {
        // Storage full / disabled — fail quietly; Save still works.
      }
    }, 600);
    return () => {
      if (editSaveTimer.current) clearTimeout(editSaveTimer.current);
    };
  }, [draftContent, editing, EDIT_DRAFT_KEY]);

  /* Warn before leaving the page with unsaved edits. */
  useEffect(() => {
    if (!editing) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const dirty =
        draftContent &&
        report &&
        JSON.stringify(draftContent) !== JSON.stringify(report.content);
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editing, draftContent, report]);

  // Look for a saved-but-not-committed local draft for this report and,
  // if it's actually different from what's in the DB, surface a restore
  // banner. Called when entering edit mode. `dbContent` is passed
  // explicitly because the deep-link path runs before `report` state
  // has settled.
  function detectRecoverableDraft(dbContent: ReportContent) {
    try {
      const raw = localStorage.getItem(EDIT_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { content?: ReportContent; savedAt?: string };
      if (
        parsed?.content &&
        JSON.stringify(parsed.content) !== JSON.stringify(dbContent)
      ) {
        setRecoverableAt(parsed.savedAt ?? null);
      } else {
        // Identical to the DB — nothing meaningful to recover; clear it.
        localStorage.removeItem(EDIT_DRAFT_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  function restoreLocalDraft() {
    try {
      const raw = localStorage.getItem(EDIT_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { content?: ReportContent };
        if (parsed?.content) {
          editHydrated.current = true; // don't re-trigger a save from the restore
          setDraftContent(parsed.content);
          setEditSaveState("saved");
        }
      }
    } catch {
      /* ignore */
    }
    setRecoverableAt(null);
  }

  function discardLocalDraft() {
    try {
      localStorage.removeItem(EDIT_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setRecoverableAt(null);
  }

  function clearEditDraft() {
    if (editSaveTimer.current) clearTimeout(editSaveTimer.current);
    try {
      localStorage.removeItem(EDIT_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setEditSaveState("idle");
    setRecoverableAt(null);
    editHydrated.current = false;
  }

  function startEdit() {
    if (!report) return;
    // Edits to a finalised report are allowed but warned — the audit
    // trail still shows it was once signed off.
    if (report.status === "final") {
      const ok = window.confirm(
        "This report is finalised. Your edits will overwrite the saved content but the finalised status stays. Continue?",
      );
      if (!ok) return;
    }
    editHydrated.current = false;
    setEditSaveState("idle");
    setDraftContent(JSON.parse(JSON.stringify(report.content)));
    setEditing(true);
    setSaveError(null);
    detectRecoverableDraft(report.content);
  }

  function cancelEdit() {
    setEditing(false);
    setDraftContent(null);
    setSaveError(null);
    clearEditDraft();
  }

  async function saveEdit() {
    if (!report || !draftContent) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftContent }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(
          typeof body.error === "string" ? body.error : `Save failed (${res.status})`,
        );
      }
      setReport({ ...report, content: draftContent });
      setEditing(false);
      setDraftContent(null);
      clearEditDraft();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <Panel>
        <p className="p-10 text-center text-sm text-muted-foreground">
          Report not found.
        </p>
      </Panel>
    );
  }

  const status = (report.status || "draft").toLowerCase();
  const tone = editing ? "warn" : status === "final" ? "success" : "warn";
  const chipLabel = editing
    ? "Editing"
    : status[0].toUpperCase() + status.slice(1);

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link
          href="/reports"
          className="ds-link inline-flex items-center"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to reports
        </Link>
      </div>

      <div className="print:hidden">
        <Toolbar
          title={`${report.client.firstName} ${report.client.lastName}`}
          subtitle={
            editing
              ? "Editing — your changes are kept on this device; click Save to store them"
              : status === "draft"
                ? `Draft saved — come back and finish it any time · dated ${new Date(
                    report.reportDate,
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}`
                : `Report dated ${new Date(report.reportDate).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}`
          }
          actions={
            <div className="flex items-center gap-3">
              <Chip tone={tone}>{chipLabel}</Chip>
              {editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Auto-save status — reassures the OT their edits are
                      being kept on this device even before they Save. */}
                  {editSaveState !== "idle" && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title="Your edits are kept on this device until you click Save"
                    >
                      {editSaveState === "saving" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3 text-green-600" />
                          Draft kept
                        </>
                      )}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={saving || tidyLoading}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  {/* AI tidy — runs Claude over the current draft
                      to fix grammar / tone, opens side-by-side review
                      modal. Apply replaces draftContent; the OT then
                      hits Save to persist as normal. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runTidy}
                    disabled={saving || tidyLoading}
                    title="Ask Claude to tidy grammar + tone without changing clinical content"
                  >
                    {tidyLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {tidyLoading ? "Tidying…" : "Tidy with AI"}
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={startEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSummaryOpen(true)}
                      title="Generate an AI summary of this report and email it to someone"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Summary
                    </Button>
                  )}
                  <ReportActions
                    reportId={report.id}
                    status={report.status}
                    onStatusChange={(s) => setReport({ ...report, status: s })}
                    showEmail={isAdmin}
                  />
                </div>
              )}
            </div>
          }
        />
        {saveError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {saveError}
          </p>
        )}
      </div>

      {/* Restore prompt — appears when we find unsaved edits kept on
          this device from a previous editing session for this report. */}
      {editing && recoverableAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700/60 dark:bg-amber-900/20 print:hidden">
          <span className="text-amber-900 dark:text-amber-200">
            We found unsaved edits from{" "}
            <strong>
              {new Date(recoverableAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>{" "}
            kept on this device. Restore them?
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={discardLocalDraft}>
              Discard
            </Button>
            <Button size="sm" onClick={restoreLocalDraft}>
              Restore edits
            </Button>
          </div>
        </div>
      )}

      <ReportViewer
        content={editing && draftContent ? draftContent : report.content}
        editing={editing}
        onChange={(next) => setDraftContent(next)}
      />

      {/* AI tidy review — opens when "Tidy with AI" is clicked. */}
      <TidyReviewDialog
        open={tidyOpen}
        loading={tidyLoading}
        error={tidyError}
        before={tidyBefore}
        after={tidyAfter}
        onApplySection={applyTidySection}
        onClose={closeTidy}
      />

      {/* AI summary + email — opens via the Summary button. */}
      <ReportSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        reportId={report.id}
        clientName={`${report.client.firstName} ${report.client.lastName}`}
        defaultTo={report.client.parentCarerEmail ?? ""}
      />
    </div>
  );
}
