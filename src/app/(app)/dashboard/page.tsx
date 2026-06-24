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
import { Toolbar, Panel, Chip, Seg, LinkBtn, Avatar, Empty } from "@/components/ds";

/**
 * Dashboard — V1 "Polished" landing page for practice admins.
 *
 *   1. Toolbar — greeting, date range, time segment, "New Report".
 *   2. 4 KPI cards (active clients, reports MTD, bookings this week,
 *      revenue MTD) with % delta and a 14-day sparkline.
 *   3. Client Pipeline funnel + Today's Schedule.
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
interface RangeMetrics {
  revenuePence: number;
  revenueDeltaPct: number;
  reports: number;
  reportsDeltaPct: number;
  bookings: number;
  bookingsDeltaPct: number;
  newClients: number;
  clientsDeltaPct: number;
}
interface DashData {
  kpis: Kpi[];
  metricsByRange?: Record<"today" | "week" | "month" | "quarter", RangeMetrics>;
  activeClients?: number;
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

function reportChipTone(s: ReportRow["status"]) {
  return {
    overdue: "danger" as const,
    drafting: "warn" as const,
    ready: "success" as const,
    sent: "primary" as const,
  }[s];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashData>(DEFAULT_DATA);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "overdue" | "drafting" | "sent"
  >("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "quarter">("week");
  const [revWindow, setRevWindow] = useState<14 | 30 | 90>(14);

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

  // KPI cards driven by the Today/Week/Month/Quarter selector. Values come
  // from the period metrics; the spark series are the shared 14-day trends.
  const displayKpis = useMemo<Kpi[]>(() => {
    const m = data.metricsByRange?.[dateRange];
    const rl = { today: "Today", week: "This week", month: "This month", quarter: "This quarter" }[dateRange];
    const low = rl.toLowerCase();
    const sp = (i: number) => data.kpis[i]?.spark ?? [];
    return [
      {
        key: "active_clients",
        label: "Active Clients",
        value: String(data.activeClients ?? 0),
        deltaPct: m?.clientsDeltaPct ?? 0,
        helper: `${m?.newClients ?? 0} new · ${low}`,
        spark: sp(0),
      },
      {
        key: "reports",
        label: `Reports · ${rl}`,
        value: String(m?.reports ?? 0),
        deltaPct: m?.reportsDeltaPct ?? 0,
        helper: `${m?.reports ?? 0} ${low}`,
        spark: sp(1),
      },
      {
        key: "bookings",
        label: `Bookings · ${rl}`,
        value: String(m?.bookings ?? 0),
        deltaPct: m?.bookingsDeltaPct ?? 0,
        helper: `${data.agenda.length} today`,
        spark: sp(2),
      },
      {
        key: "revenue",
        label: `Revenue · ${rl}`,
        value: formatCurrency((m?.revenuePence ?? 0) / 100),
        deltaPct: m?.revenueDeltaPct ?? 0,
        helper: "Received in Fire",
        spark: sp(3),
      },
    ];
  }, [data, dateRange]);

  const maxPipeline = useMemo(
    () => Math.max(1, ...data.pipeline.map((p) => p.count)),
    [data.pipeline],
  );
  // Slice the 90-day series to the selected window for the chart.
  const chartRevenue = useMemo(
    () => data.revenue.slice(-revWindow),
    [data.revenue, revWindow],
  );
  const maxRevenue = useMemo(
    () => Math.max(1, ...chartRevenue.map((r) => r.v)),
    [chartRevenue],
  );

  const filteredReports = useMemo(() => {
    if (statusFilter === "all") return data.reports;
    return data.reports.filter((r) => r.status === statusFilter);
  }, [data.reports, statusFilter]);

  return (
    <div className="space-y-6">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <Toolbar
        title="Practice Overview"
        help="dashboard"
        subtitle={`${date} · Good ${tod}`}
        actions={
          <>
            <button className="ds-pill-btn" type="button">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Last 30 days</span>
            </button>
            <Seg
              value={dateRange}
              onChange={setDateRange}
              options={[
                { value: "today", label: "Today" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "quarter", label: "Quarter" },
              ]}
            />
            <Link href="/reports/new" className={buttonVariants({ className: "rounded-xl" })}>
              <Plus className="mr-2 h-4 w-4" />
              New Report
            </Link>
          </>
        }
      />

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(loading ? Array.from({ length: 4 }) : displayKpis).map((raw, i) => {
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
            <div key={k?.key ?? i} className={`ds-kpi ${i === 3 ? "accent" : ""}`}>
              <div className="ds-kpi-head">
                <span className="ds-kpi-label">{k?.label ?? "\u00A0"}</span>
                <span className="ds-kpi-icon">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span className="ds-kpi-value ds-tabular">
                  {loading ? "—" : k?.value ?? "0"}
                </span>
                {k && (
                  <span className={`ds-kpi-delta ${deltaTone}`}>
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
              <div className="ds-kpi-foot">
                <span>{k?.helper ?? ""}</span>
                <span>vs last period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pipeline funnel + Today's schedule ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel
          title="Client Pipeline"
          subtitle={`Where your ${data.pipelineTotal} active clients are`}
          actions={
            <LinkBtn href="/clients">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </LinkBtn>
          }
          padded
        >
          {data.pipeline.length === 0 && !loading ? (
            <Empty>No stages yet. Configure client stages in settings.</Empty>
          ) : (
            data.pipeline.map((p) => (
              <div className="ds-funnel-row" key={p.stage}>
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
                <span className="f-count ds-tabular">{p.count}</span>
              </div>
            ))
          )}
        </Panel>

        <Panel
          title="Today's Schedule"
          subtitle={`${data.agenda.length} booking${data.agenda.length === 1 ? "" : "s"}`}
          actions={
            <LinkBtn href="/bookings">
              Open calendar <ChevronRight className="h-3.5 w-3.5" />
            </LinkBtn>
          }
        >
          {data.agenda.length === 0 ? (
            <Empty>No bookings today.</Empty>
          ) : (
            data.agenda.map((a) => (
              <Link href="/bookings" className="ds-agenda-item" key={a.id}>
                <div className="ds-agenda-time">
                  {a.time}
                  <span className="ampm">{a.ampm}</span>
                </div>
                <div className="ds-agenda-row">
                  <span className={`ds-agenda-kind ${a.tone}`} />
                  <div style={{ minWidth: 0 }}>
                    <p className="ds-a-name">{a.client}</p>
                    <p className="ds-a-meta">
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
        </Panel>
      </div>

      {/* ── Reports table + Revenue chart ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Reports"
          subtitle={
            <>
              {data.reportCounts.overdue} overdue ·{" "}
              {data.reportCounts.ready} ready to send ·{" "}
              {data.reportCounts.drafting} drafting
            </>
          }
          actions={
            <Seg
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "overdue", label: "Overdue" },
                { value: "drafting", label: "Drafting" },
                { value: "sent", label: "Sent" },
              ]}
            />
          }
          footer={
            <>
              <span>
                Showing {filteredReports.length} of {data.reports.length}
              </span>
              <LinkBtn href="/reports">
                Open reports <ChevronRight className="h-3.5 w-3.5" />
              </LinkBtn>
            </>
          }
        >
          {filteredReports.length === 0 ? (
            <Empty>{loading ? "Loading…" : "No reports match this filter."}</Empty>
          ) : (
            <table className="ds-table">
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
                      className="ds-tabular"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {r.date}
                    </td>
                    <td>
                      <Chip tone={reportChipTone(r.status)}>
                        {r.status[0].toUpperCase() + r.status.slice(1)}
                      </Chip>
                    </td>
                    <td>
                      <Avatar name={r.author} size="sm" />
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
        </Panel>

        <Panel
          title={`Revenue · ${revWindow} days`}
          subtitle={
            <>
              This month{" "}
              <strong style={{ color: "var(--foreground)" }}>
                {formatCurrency(data.revenueSummary.invoicedMtd)}
              </strong>
            </>
          }
          actions={
            <div className="ds-seg">
              {([14, 30, 90] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={revWindow === w ? "is-active" : ""}
                  onClick={() => setRevWindow(w)}
                >
                  {w}d
                </button>
              ))}
            </div>
          }
          padded
        >
          <div className="ds-barchart" aria-label={`Revenue last ${revWindow} days`}>
            {chartRevenue.every((r) => r.v === 0) ? (
              <div className="ds-empty" style={{ gridColumn: "1 / -1" }}>
                No payments received in this window.
              </div>
            ) : (
              chartRevenue.map((r) => {
                const hPct = (r.v / maxRevenue) * 100;
                return (
                  <div className="ds-bc-col" key={r.d}>
                    <div
                      className={`ds-bc-bar ${r.active ? "is-active" : ""}`}
                      style={{ height: `${Math.max(4, hPct)}%` }}
                      title={`${r.d}: ${formatCurrency(r.v)}`}
                    />
                    {revWindow === 14 && (
                      <span className="ds-bc-label">
                        {new Date(r.d).toLocaleDateString("en-GB", {
                          weekday: "short",
                        })[0]}
                      </span>
                    )}
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
              <p className="ds-kpi-label" style={{ margin: 0 }}>
                Invoiced
              </p>
              <p
                className="ds-tabular"
                style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 0" }}
              >
                {formatCurrency(data.revenueSummary.invoicedMtd)}
              </p>
            </div>
            <div>
              <p className="ds-kpi-label" style={{ margin: 0 }}>
                Collected
              </p>
              <p
                className="ds-tabular"
                style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 0" }}
              >
                {formatCurrency(data.revenueSummary.collectedMtd)}
              </p>
            </div>
            <div>
              <p className="ds-kpi-label" style={{ margin: 0 }}>
                Outstanding
              </p>
              <p
                className="ds-tabular"
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
        </Panel>
      </div>
    </div>
  );
}
