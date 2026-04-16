"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Plus,
  Search,
  PoundSterling,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  const locales: Record<string, string> = { GBP: "en-GB", EUR: "en-IE", USD: "en-US" };
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

/* ------------------------------------------------------------------ */
/*  Status badge config                                                */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  Invoice["status"],
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  sent: {
    label: "Sent",
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  },
  paid: {
    label: "Paid",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  },
  overdue: {
    label: "Overdue",
    className:
      "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-gray-100 text-gray-500 line-through dark:bg-gray-800 dark:text-gray-500",
  },
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

  /* ---------- Filtered + searched invoices ---------- */
  const filteredInvoices = useMemo(() => {
    let list = invoices;

    if (activeFilter !== "all") {
      list = list.filter((inv) => inv.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.clientName.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q)
      );
    }

    return list;
  }, [invoices, activeFilter, searchQuery]);

  /* ---------- Filter tabs ---------- */
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

  /* ---------- Stat cards ---------- */
  const statCards = stats
    ? [
        {
          label: "Total Invoiced",
          amount: stats.totalInvoiced,
          count: stats.countAll,
          countLabel: "invoices",
          icon: PoundSterling,
          borderColour: "border-l-blue-500",
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColour: "text-blue-600 dark:text-blue-400",
        },
        {
          label: "Paid",
          amount: stats.totalPaid,
          count: stats.countPaid,
          countLabel: "paid",
          icon: CheckCircle2,
          borderColour: "border-l-green-500",
          iconBg: "bg-green-50 dark:bg-green-950/30",
          iconColour: "text-green-600 dark:text-green-400",
        },
        {
          label: "Unpaid",
          amount: stats.totalUnpaid,
          count: stats.countSent + stats.countDraft,
          countLabel: "outstanding",
          icon: Clock,
          borderColour: "border-l-amber-500",
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColour: "text-amber-600 dark:text-amber-400",
        },
        {
          label: "Overdue",
          amount: stats.totalOverdue,
          count: stats.countOverdue,
          countLabel: "overdue",
          icon: AlertCircle,
          borderColour: "border-l-red-500",
          iconBg: "bg-red-50 dark:bg-red-950/30",
          iconColour: "text-red-600 dark:text-red-400",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and track all invoices.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className={buttonVariants({ className: "rounded-xl" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm)]">
          Loading invoices...
        </div>
      ) : (
        <>
          {/* ---- Stat cards ---- */}
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className={cn(
                      "rounded-2xl border border-border border-l-4 bg-card p-5 shadow-[var(--shadow-sm)]",
                      card.borderColour
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          card.iconBg
                        )}
                      >
                        <Icon className={cn("h-5 w-5", card.iconColour)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {card.label}
                        </p>
                        <p className="text-lg font-bold tracking-tight">
                          {formatCurrency(card.amount)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {card.count} {card.countLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- Filters + search ---- */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    activeFilter === tab.key
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                      activeFilter === tab.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* ---- Invoice table ---- */}
          {filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold">No invoices found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery || activeFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Create your first invoice to get started."}
              </p>
              {!searchQuery && activeFilter === "all" && (
                <Link
                  href="/invoices/new"
                  className={buttonVariants({
                    className: "mt-4 rounded-xl",
                  })}
                >
                  Create Invoice
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
              {/* Table header */}
              <div className="hidden border-b border-border px-5 py-3 sm:grid sm:grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.8fr_0.7fr] sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invoice
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Client
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Due Date
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  Amount
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  Status
                </p>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-border">
                {filteredInvoices.map((inv) => {
                  const statusCfg = STATUS_CONFIG[inv.status];
                  const overdue = isOverdue(inv.dueDate, inv.status);

                  return (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="block px-5 py-4 transition-colors hover:bg-muted/30"
                    >
                      {/* Desktop row */}
                      <div className="hidden sm:grid sm:grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.8fr_0.7fr] sm:items-center sm:gap-4">
                        <p className="text-sm font-semibold text-foreground">
                          {inv.invoiceNumber}
                        </p>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {inv.clientName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {inv.clientEmail}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(inv.createdAt)}
                        </p>
                        <p
                          className={cn(
                            "text-sm",
                            overdue
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatDate(inv.dueDate)}
                        </p>
                        <p className="text-right text-sm font-semibold text-foreground">
                          {formatCurrency(inv.total, inv.currency)}
                        </p>
                        <div className="flex justify-end">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              statusCfg.className
                            )}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Mobile row */}
                      <div className="sm:hidden">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {inv.invoiceNumber}
                              </p>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  statusCfg.className
                                )}
                              >
                                {statusCfg.label}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {inv.clientName}
                            </p>
                          </div>
                          <p className="ml-4 text-sm font-semibold text-foreground">
                            {formatCurrency(inv.total, inv.currency)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(inv.createdAt)}</span>
                          <span className="text-border">|</span>
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
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
