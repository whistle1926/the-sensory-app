"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  PoundSterling,
  Search,
  Send,
  Trash2,
  X,
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

type StatusFilter =
  | "all"
  | "unpaid"
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

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

// The portal no longer tracks payment — that lives in FireBuddy. We only
// show whether an invoice is still a Draft, has been Sent, or was
// Cancelled. Any legacy paid/overdue rows collapse to "Sent".
const STATUS_TONE: Record<Invoice["status"], ChipTone> = {
  draft: "neutral",
  sent: "info",
  paid: "info",
  overdue: "info",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<Invoice["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Sent",
  overdue: "Sent",
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

  // Inline delete state (mirror of the /reports list pattern). Only
  // one row is ever in confirm/in-flight at a time so plain ids work.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteInvoice(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadInvoices() {
    try {
      const r = await fetch("/api/invoices");
      const data = await r.json();
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  const filtered = useMemo(() => {
    let list = invoices;
    if (activeFilter === "draft") {
      list = list.filter((inv) => inv.status === "draft");
    } else if (activeFilter === "sent") {
      // "Sent" = anything that's left draft, incl. legacy paid/overdue.
      list = list.filter((inv) =>
        ["sent", "paid", "overdue"].includes(inv.status),
      );
    } else if (activeFilter === "cancelled") {
      list = list.filter((inv) => inv.status === "cancelled");
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
          {
            key: "sent",
            label: "Sent",
            // "Sent" now covers everything that's been sent — including
            // legacy paid/overdue rows (payment lives in FireBuddy).
            count:
              stats.countSent + stats.countPaid + stats.countOverdue,
          },
          { key: "cancelled", label: "Cancelled", count: stats.countCancelled },
        ]
      : [];

  // KPI cards (top row). Payment status lives in FireBuddy, so we only
  // summarise what the portal owns: how much has been invoiced and how
  // many invoices are drafts vs sent.
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
          label: "Sent",
          value: String(stats.countSent + stats.countPaid + stats.countOverdue),
          helper: "sent to clients",
          icon: Send,
          accent: false,
        },
        {
          label: "Drafts",
          value: String(stats.countDraft),
          helper: "not sent yet",
          icon: FileText,
          accent: false,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Toolbar
        title="Invoices"
        subtitle="Manage and track all invoices"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/invoices/new"
              className={buttonVariants({ className: "rounded-xl" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Link>
          </div>
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
            <div className="grid gap-4 sm:grid-cols-3">
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
                        const isConfirming = confirmDeleteId === inv.id;
                        const isDeleting = deletingId === inv.id;
                        // Legacy "paid" rows can't be deleted server-side;
                        // hide the trash button to avoid a rejected request.
                        const canDelete = inv.status !== "paid";

                        if (isConfirming) {
                          return (
                            <tr
                              key={inv.id}
                              style={{ background: "rgba(239,68,68,0.04)" }}
                            >
                              <td colSpan={7}>
                                <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
                                  <span className="text-sm">
                                    Delete <strong>{inv.invoiceNumber}</strong>{" "}
                                    for <strong>{inv.clientName}</strong>{" "}
                                    ({formatCurrency(inv.total, inv.currency)})?
                                    This is permanent.
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {deleteError && (
                                      <span className="text-xs text-red-600">
                                        {deleteError}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(null);
                                        setDeleteError(null);
                                      }}
                                      disabled={isDeleting}
                                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                                    >
                                      <X className="h-3 w-3" />
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteInvoice(inv.id);
                                      }}
                                      disabled={isDeleting}
                                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                                    >
                                      {isDeleting ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Deleting…
                                        </>
                                      ) : (
                                        <>
                                          <Trash2 className="h-3 w-3" />
                                          Confirm delete
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }

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
                              <div className="inline-flex items-center gap-1">
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(inv.id);
                                      setDeleteError(null);
                                    }}
                                    title="Delete invoice"
                                    aria-label="Delete invoice"
                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <ChevronRight
                                  className="h-3.5 w-3.5"
                                  style={{ color: "var(--muted-foreground)" }}
                                />
                              </div>
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
