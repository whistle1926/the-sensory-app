"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ChevronRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Toolbar, Panel, Chip, Seg, Empty } from "@/components/ds";

interface Report {
  id: string;
  reportDate: string;
  status: string;
  client: { firstName: string; lastName: string };
}

type StatusFilter = "all" | "draft" | "final";

/**
 * Reports list — admin view. Compact, status-driven table inside a Panel.
 * Dashboard-style toolbar up top, segmented filter in the panel head.
 */
export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => {
        setReports(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((r) => (r.status || "").toLowerCase() === filter);
  }, [reports, filter]);

  const counts = useMemo(
    () => ({
      all: reports.length,
      draft: reports.filter((r) => (r.status || "").toLowerCase() === "draft")
        .length,
      final: reports.filter((r) => (r.status || "").toLowerCase() === "final")
        .length,
    }),
    [reports],
  );

  return (
    <div className="space-y-6">
      <Toolbar
        title="Reports"
        subtitle={
          loading
            ? "Loading…"
            : `${counts.all} total · ${counts.draft} drafting · ${counts.final} final`
        }
        actions={
          <Link
            href="/reports/new"
            className={buttonVariants({ className: "rounded-xl" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Link>
        }
      />

      <Panel
        actions={
          <Seg
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All · ${counts.all}` },
              { value: "draft", label: `Draft · ${counts.draft}` },
              { value: "final", label: `Final · ${counts.final}` },
            ]}
          />
        }
        footer={
          <>
            <span>
              Showing {filtered.length} of {reports.length}
            </span>
          </>
        }
      >
        {loading ? (
          <Empty>Loading reports…</Empty>
        ) : filtered.length === 0 ? (
          <div className="ds-empty">
            <FileText
              className="mx-auto h-7 w-7"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No reports yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Drop session notes in and your first report appears here.
            </p>
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Date</th>
                <th>Status</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = (r.status || "draft").toLowerCase();
                const tone = s === "final" ? "success" : "warn";
                const label = s[0].toUpperCase() + s.slice(1);
                return (
                  <tr
                    key={r.id}
                    onClick={() => {
                      window.location.href = `/reports/${r.id}`;
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>
                      {r.client.firstName} {r.client.lastName}
                    </td>
                    <td
                      className="ds-tabular"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {new Date(r.reportDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <Chip tone={tone}>{label}</Chip>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <ChevronRight
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
