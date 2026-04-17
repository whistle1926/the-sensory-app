"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  FileClock,
  Plus,
  PoundSterling,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sparkline } from "@/components/dashboard/sparkline";
import "./dashboard.css";

/**
 * Dashboard — V1 "Polished" layout.
 *
 * Landing page for practice admins. Shows:
 *   1. Toolbar — greeting, date range, time segment, "New Report".
 *   2. 4 KPI cards (active clients, reports MTD, bookings this week,
 *      revenue MTD) with % delta and a 14-day sparkline.
 *   3. Client Pipeline funnel + Today's Schedule (two-column).
 *   4. Reports table (status-driven) + 14-day Revenue bar chart.
 */

interface Kpi {
  key: string;
  label: string;
  value: string;
  deltaPct: number;
  helper: string;
  spark: number[];
}
interface PipelineRow {
  stage: string;
  count: number;
  color: string;
}
interface AgendaItem {
  id: string;
  time: string;
  ampm: string;
  client: string;
  kind: string;
  with: string;
  room: string;
  tone: "" | "teal" | "green" | "amber" | "magenta";
}
interface ReportRow {
  id: string;
  name: string;
  kind: string;
  date: string;
  status: "overdue" | "drafting" | "ready" | "sent";
  author: string;
}
interface RevenueCell {
  d: string;
  v: number;
  active: boolean;
}
interface DashData {
  kpis: Kpi[];
  pipeline: PipelineRow[];
  pipelineTotal: number;
  agenda: AgendaItem[];
  reports: ReportRow[];
  reportCounts: { overdue: number; ready: number; drafting: number; sent: number };
  revenue: RevenueCell[];
  revenueSummary: {
    invoicedMtd: number;
    collectedMtd: number;
    outstandingMtd: number;
  };
  now: string;
}

const DEFAULT_DATA: DashData = {
  kpis: [],
  pipeline: [],
  pipelineTotal: 0,
  agenda: [],
  reports: [],
  reportCounts: { overdue: 0, ready: 0, drafting: 0, sent: 0 },
  revenue: [],
  revenueSummary: { invoicedMtd: 0, collectedMtd: 0, outstandingMtd: 0 },
  now: new Date().toISOString(),
};

const KPI_ICONS = [Users, FileClock, CalendarDays, PoundSterling] as const;

function formatCurrency(pounds: number) {
  return "£" + Math.round(pounds).toLocaleString("en-GB");
}

function formatGreeting(iso: string) {
  const d = new Date(iso);
  const hour = d.getHours();
  const tod = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const date = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return { date, tod };
}

function statusChipClass(s: ReportRow["status"]) {
  return {
    overdue: "chip chip-danger",
    drafting: "chip chip-warn",
    ready: "chip chip-success",
    sent: "chip chip-primary",
  }[s];
}

function statusLabel(s: ReportRow["status"]) {
  return s[0].toUpperCase() + s.slice(1);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashData>(DEFAULT_DATA);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "overdue" | "drafting" | "sent"
  >("all");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((raw) => setData({ ...DEFAULT_DATA, ...raw }))
      .catch(() => setData(DEFAULT_DATA))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { date, tod } = useMemo(() => formatGreeting(data.now), [data.now]);

  const maxPipeline = useMemo(
    () => Math.max(1, ...data.pipeline.map((p) => p.count)),
    [data.pipeline],
  );
  const maxRevenue = useMemo(
    () => Math.max(1, ...data.revenue.map((r) => r.v)),
    [data.revenue],
  );

  const filteredReports = useMemo(() => {
    if (statusFilter === "all") return data.reports;
    return data.reports.filter((r) => r.status === statusFilter);
  }, [data.reports, statusFilter]);

  return (
    <div className="dash-v1 space-y-6">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="dash-toolbar">
        <div>
          <h1 className="page-title">Practice Overview</h1>
          <p className="page-subtitle">
            {date} · Good {tod}
          </p>
        </div>
        <div className="right">
          <button className="date-range" type="button">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Last 30 days</span>
          </button>
          <div className="seg" role="tablist">
            <button type="button">Today</button>
            <button type="button" className="is-active">
              Week
            </button>
            <button type="button">Month</button>
            <button type="button">Quarter</button>
          </div>
          <Link href="/reports/new" className={buttonVariants({ className: "rounded-xl" })}>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Link>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(loading ? Array.from({ length: 4 }) : data.kpis).map((raw, i) => {
          const k = raw as Kpi | undefined;
          const Icon = KPI_ICONS[i] ?? Users;
          const Trend =
            k && k.deltaPct > 0 ? TrendingUp : k && k.deltaPct < 0 ? TrendingDown : TrendingUp;
          const deltaTone =
            !k || k.deltaPct === 0
              ? "flat"
              : k.deltaPct > 0
                ? "up"
                : "down";
          return (
            <div key={k?.key ?? i} className={`kpi ${i === 3 ? "accent" : ""}`}>
              <div className="kpi-head">
                <span className="kpi-label">{k?.label ?? "\u00A0"}</span>
                <span className="kpi-icon">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span className="kpi-value tabular">
                  {loading ? "—" : k?.value ?? "0"}
                </span>
                {k && (
                  <span className={`kpi-delta ${deltaTone}`}>
                    <Trend className="h-3 w-3" />
                    {k.deltaPct > 0 ? "+" : ""}
                    {k.deltaPct}%
                  </span>
                )}
              </div>
              <Sparkline
                data={k?.spark ?? []}
                color={i === 1 ? "oklch(0.72 0.14 60)" : "var(--primary)"}
              />
              <div className="kpi-foot">
                <span>{k?.helper ?? ""}</span>
                <span>vs last period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pipeline funnel + Today's schedule ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Client Pipeline</h2>
              <p className="panel-sub">
                Where your {data.pipelineTotal} active clients are
              </p>
            </div>
            <Link href="/clients" className="link-btn">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="panel-body padded">
            {data.pipeline.length === 0 && !loading ? (
              <div className="empty">
                No stages yet. Configure client stages in settings.
              </div>
            ) : (
              data.pipeline.map((p) => (
                <div className="funnel-row" key={p.stage}>
                  <span className="f-label">{p.stage}</span>
                  <div className="f-bar">
                    <span
                      style={{
                        width: `${(p.count / maxPipeline) * 100}%`,
                        background: p.color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <span className="f-count tabular">{p.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Today&apos;s Schedule</h2>
              <p className="panel-sub">
                {data.agenda.length} booking{data.agenda.length === 1 ? "" : "s"}
              </p>
            </div>
            <Link href="/bookings" className="link-btn">
              Open calendar <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="panel-body">
            {data.agenda.length === 0 ? (
              <div className="empty">No bookings today.</div>
            ) : (
              data.agenda.map((a) => (
                <Link href="/bookings" className="agenda-item" key={a.id}>
                  <div className="agenda-time">
                    {a.time}
                    <span className="ampm">{a.ampm}</span>
                  </div>
                  <div className="agenda-row">
                    <span className={`agenda-kind ${a.tone}`} />
                    <div style={{ minWidth: 0 }}>
                      <p className="a-name">{a.client}</p>
                      <p className="a-meta">
                        {a.kind}
                        {a.room ? ` · ${a.room}` : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Reports table + Revenue chart ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Reports</h2>
              <p className="panel-sub">
                {data.reportCounts.overdue} overdue ·{" "}
                {data.reportCounts.ready} ready to send ·{" "}
                {data.reportCounts.drafting} drafting
              </p>
            </div>
            <div className="seg">
              {(["all", "overdue", "drafting", "sent"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={statusFilter === k ? "is-active" : ""}
                  onClick={() => setStatusFilter(k)}
                >
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {filteredReports.length === 0 ? (
              <div className="empty">
                {loading ? "Loading…" : "No reports match this filter."}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => {
                        window.location.href = `/reports/${r.id}`;
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td style={{ color: "var(--muted-foreground)" }}>{r.kind}</td>
                      <td
                        className="tabular"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {r.date}
                      </td>
                      <td>
                        <span className={statusChipClass(r.status)}>
                          <span className="dot" />
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td>
                        <span className="av sm">{r.author}</span>
                      </td>
                      <td>
                        <ChevronRight
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="panel-foot">
            <span>
              Showing {filteredReports.length} of {data.reports.length}
            </span>
            <Link href="/reports" className="link-btn">
              Open reports <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Revenue · 14 days</h2>
              <p className="panel-sub">
                MTD{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {formatCurrency(data.revenueSummary.invoicedMtd)}
                </strong>
              </p>
            </div>
            <div className="seg">
              <button type="button" className="is-active">
                14d
              </button>
              <button type="button">30d</button>
              <button type="button">90d</button>
            </div>
          </div>
          <div className="panel-body padded">
            <div className="barchart" aria-label="Revenue last 14 days">
              {data.revenue.length === 0 ? (
                <div className="empty" style={{ gridColumn: "1 / -1" }}>
                  No paid invoices in this window.
                </div>
              ) : (
                data.revenue.map((r) => {
                  const hPct = (r.v / maxRevenue) * 100;
                  return (
                    <div className="bc-col" key={r.d}>
                      <div
                        className={`bc-bar ${r.active ? "is-active" : ""}`}
                        style={{ height: `${Math.max(4, hPct)}%` }}
                        title={`${r.d}: ${formatCurrency(r.v)}`}
                      />
                      <span className="bc-label">
                        {new Date(r.d).toLocaleDateString("en-GB", {
                          weekday: "short",
                        })[0]}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 16 }}
            >
              <div>
                <p className="kpi-label" style={{ margin: 0 }}>
                  Invoiced
                </p>
                <p
                  className="tabular"
                  style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 0" }}
                >
                  {formatCurrency(data.revenueSummary.invoicedMtd)}
                </p>
              </div>
              <div>
                <p className="kpi-label" style={{ margin: 0 }}>
                  Collected
                </p>
                <p
                  className="tabular"
                  style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 0" }}
                >
                  {formatCurrency(data.revenueSummary.collectedMtd)}
                </p>
              </div>
              <div>
                <p className="kpi-label" style={{ margin: 0 }}>
                  Outstanding
                </p>
                <p
                  className="tabular"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    margin: "2px 0 0",
                    color: "oklch(0.577 0.245 27.325)",
                  }}
                >
                  {formatCurrency(data.revenueSummary.outstandingMtd)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
