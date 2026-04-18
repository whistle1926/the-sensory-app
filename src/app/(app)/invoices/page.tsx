"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  PoundSterling,
  Search,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Toolbar, Panel, Chip, Empty, type ChipTone } from "@/components/ds";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  total: number;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  items: InvoiceItem[];
}

interface InvoiceStats {
  totalInvoiced: number;
  totalPaid: number;
  totalUnpaid: number;
  totalOverdue: number;
  countAll: number;
  countDraft: number;
  countSent: number;
  countPaid: number;
  countOverdue: number;
  countCancelled: number;
}

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue" | "cancelled";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(pence: number, cur: string = "GBP"): string {
  const locales: Record<string, string> = {
    GBP: "en-GB",
    EUR: "en-IE",
    USD: "en-US",
  };
  return (pence / 100).toLocaleString(locales[cur] || "en-GB", {
    style: "currency",
    currency: cur,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === "paid" || status === "cancelled") return false;
  return new Date(dueDate) < new Date();
}

const STATUS_TONE: Record<Invoice["status"], ChipTone> = {
  draft: "neutral",
  sent: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<Invoice["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => {
        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
        setStats(data.stats ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = invoices;
    if (activeFilter !== "all") {
      list = list.filter((inv) => inv.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.clientName.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q),
      );
    }
    return list;
  }, [invoices, activeFilter, searchQuery]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] =
    stats
      ? [
          { key: "all", label: "All", count: stats.countAll },
          { key: "draft", label: "Draft", count: stats.countDraft },
          { key: "sent", label: "Sent", count: stats.countSent },
          { key: "paid", label: "Paid", count: stats.countPaid },
          { key: "overdue", label: "Overdue", count: stats.countOverdue },
          { key: "cancelled", label: "Cancelled", count: stats.countCancelled },
        ]
      : [];

  // KPI cards (top row) — mirrors the dashboard KPI pattern.
  const kpis = stats
    ? [
        {
          label: "Invoiced",
          value: formatCurrency(stats.totalInvoiced),
          helper: `${stats.countAll} invoices`,
          icon: PoundSterling,
          accent: false,
        },
        {
          label: "Paid",
          value: formatCurrency(stats.totalPaid),
          helper: `${stats.countPaid} collected`,
          icon: CheckCircle2,
          accent: false,
        },
        {
          label: "Unpaid",
          value: formatCurrency(stats.totalUnpaid),
          helper: `${stats.countSent + stats.countDraft} outstanding`,
          icon: Clock,
          accent: false,
        },
        {
          label: "Overdue",
          value: formatCurrency(stats.totalOverdue),
          helper: `${stats.countOverdue} overdue`,
          icon: AlertCircle,
          accent: true,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Toolbar
        title="Invoices"
        subtitle="Manage and track all invoices"
        actions={
          <Link
            href="/invoices/new"
            className={buttonVariants({ className: "rounded-xl" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        }
      />

      {loading ? (
        <Panel>
          <Empty>Loading invoices…</Empty>
        </Panel>
      ) : (
        <>
          {/* ---- KPI row ---- */}
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <div
                    key={k.label}
                    className={`ds-kpi ${k.accent ? "accent" : ""}`}
                  >
                    <div className="ds-kpi-head">
                      <span className="ds-kpi-label">{k.label}</span>
                      <span className="ds-kpi-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <span className="ds-kpi-value ds-tabular">{k.value}</span>
                    <div className="ds-kpi-foot">
                      <span>{k.helper}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- Filter tabs + search ---- */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    activeFilter === tab.key
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      activeFilter === tab.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search invoices…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* ---- Invoice table ---- */}
          <Panel
            footer={
              <span>
                Showing {filtered.length} of {invoices.length}
              </span>
            }
          >
            {filtered.length === 0 ? (
              <div className="ds-empty">
                <FileText
                  className="mx-auto h-7 w-7"
                  style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                />
                <p style={{ marginTop: 10, fontWeight: 600 }}>
                  No invoices found
                </p>
                <p style={{ marginTop: 4, fontSize: 12 }}>
                  {searchQuery || activeFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Create your first invoice to get started."}
                </p>
                {!searchQuery && activeFilter === "all" && (
                  <Link
                    href="/invoices/new"
                    className={buttonVariants({ className: "mt-4 rounded-xl" })}
                  >
                    Create Invoice
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Client</th>
                        <th>Date</th>
                        <th>Due</th>
                        <th className="num">Amount</th>
                        <th>Status</th>
                        <th aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv) => {
                        const overdue = isOverdue(inv.dueDate, inv.status);
                        return (
                          <tr
                            key={inv.id}
                            onClick={() => {
                              window.location.href = `/invoices/${inv.id}`;
                            }}
                          >
                            <td style={{ fontWeight: 600 }}>
                              {inv.invoiceNumber}
                            </td>
                            <td>
                              <div style={{ minWidth: 0 }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontWeight: 500,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {inv.clientName}
                                </p>
                                <p
                                  style={{
                                    margin: "2px 0 0",
                                    fontSize: 12,
                                    color: "var(--muted-foreground)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {inv.clientEmail}
                                </p>
                              </div>
                            </td>
                            <td
                              className="ds-tabular"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              {formatDate(inv.createdAt)}
                            </td>
                            <td
                              className="ds-tabular"
                              style={{
                                color: overdue
                                  ? "oklch(0.577 0.245 27.325)"
                                  : "var(--muted-foreground)",
                                fontWeight: overdue ? 600 : 400,
                              }}
                            >
                              {formatDate(inv.dueDate)}
                            </td>
                            <td
                              className="num"
                              style={{ fontWeight: 600, whiteSpace: "nowrap" }}
                            >
                              {formatCurrency(inv.total, inv.currency)}
                            </td>
                            <td>
                              <Chip tone={STATUS_TONE[inv.status]}>
                                {STATUS_LABEL[inv.status]}
                              </Chip>
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
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-border">
                  {filtered.map((inv) => {
                    const overdue = isOverdue(inv.dueDate, inv.status);
                    return (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="block px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {inv.invoiceNumber}
                              </p>
                              <Chip tone={STATUS_TONE[inv.status]}>
                                {STATUS_LABEL[inv.status]}
                              </Chip>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {inv.clientName}
                            </p>
                          </div>
                          <p className="ml-4 text-sm font-semibold tabular-nums text-foreground">
                            {formatCurrency(inv.total, inv.currency)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(inv.createdAt)}</span>
                          <span className="text-border">·</span>
                          <span
                            className={
                              overdue
                                ? "font-medium text-red-600 dark:text-red-400"
                                : ""
                            }
                          >
                            Due {formatDate(inv.dueDate)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
