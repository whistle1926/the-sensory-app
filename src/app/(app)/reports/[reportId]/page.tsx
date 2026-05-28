"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Pencil, Save, Send, Sparkles, X, Loader2 } from "lucide-react";
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

  function applyTidy() {
    if (tidyAfter) setDraftContent(tidyAfter);
    closeTidy();
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
          setDraftContent(JSON.parse(JSON.stringify(data.content)));
          setEditing(true);
        }
      });
  }, [reportId, wantsEdit]);

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
    setDraftContent(JSON.parse(JSON.stringify(report.content)));
    setEditing(true);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setDraftContent(null);
    setSaveError(null);
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
              ? "Editing — click Save to persist changes"
              : `Report dated ${new Date(report.reportDate).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "long", year: "numeric" },
                )}`
          }
          actions={
            <div className="flex items-center gap-3">
              <Chip tone={tone}>{chipLabel}</Chip>
              {editing ? (
                <div className="flex flex-wrap gap-2">
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
        onApply={applyTidy}
        onDiscard={closeTidy}
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
