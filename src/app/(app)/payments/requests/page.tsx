"use client";

/**
 * Payment requests — every payment we've asked a client for (invoices,
 * booking payment links, course checkouts) in one list, marked paid or
 * outstanding, to reconcile against Fire / the bank and chase what's owed.
 * Claire, Nov 2026. "Payments received" (/payments) is the other half:
 * money that has actually landed.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Download,
  FileText,
  GraduationCap,
  Landmark,
  Loader2,
  Mail,
  Search,
} from "lucide-react";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Source = "invoice" | "booking" | "course";
type State = "paid" | "outstanding" | "no_link" | "unfinished";

interface Row {
  id: string;
  source: Source;
  requestedAt: string;
  clientName: string;
  clientEmail: string;
  description: string;
  reference: string | null;
  amountPence: number;
  currency: string;
  state: State;
  paidAt: string | null;
  paidMethod: string | null;
  dueDate: string | null;
  payUrl: string | null;
  href: string;
  bookingId?: string;
  invoiceId?: string;
}

type Show = "owed" | "paid" | "all";

const SOURCE_LABEL: Record<Source, string> = {
  invoice: "Invoice",
  booking: "Booking",
  course: "Course",
};
const SOURCE_ICON: Record<Source, typeof FileText> = {
  invoice: FileText,
  booking: CalendarCheck,
  course: GraduationCap,
};
const METHOD_LABEL: Record<string, string> = {
  fire: "Fire",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};
/** Ways to mark a payment that came in outside Fire. */
const MANUAL_METHODS = ["bank_transfer", "cash", "card", "other"] as const;

/** Owed = asked for and not paid (course checkouts left unfinished aren't debts). */
const isOwed = (r: Row) => r.state === "outstanding" || r.state === "no_link";

function money(pence: number, cur = "GBP"): string {
  return (pence / 100).toLocaleString("en-GB", { style: "currency", currency: cur });
}
function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}
function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function PaymentRequestsPage() {
  const { data: session } = useSession();
  const canMark = session?.user?.role === "SUPER_ADMIN";
  // Inline "Mark paid" form: which row, how, and when the money arrived.
  const [marking, setMarking] = useState<string | null>(null);
  const [markMethod, setMarkMethod] = useState<string>("bank_transfer");
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markBusy, setMarkBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState<Show>("owed");
  const [source, setSource] = useState<Source | "all">("all");
  const [search, setSearch] = useState("");
  const [chasing, setChasing] = useState<string | null>(null);
  const [chased, setChased] = useState<Record<string, { ok: boolean; text: string }>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/payments/requests", { cache: "no-store" });
      const d = (await r.json()) as { rows?: Row[] };
      setRows(Array.isArray(d.rows) ? d.rows : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (show === "owed" && !isOwed(r)) return false;
      if (show === "paid" && r.state !== "paid") return false;
      if (source !== "all" && r.source !== source) return false;
      if (q) {
        const hay = `${r.clientName} ${r.clientEmail} ${r.description} ${r.reference ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, show, source, search]);

  const totals = useMemo(() => {
    const gbp = rows.filter((r) => r.currency === "GBP" && r.state !== "unfinished");
    const owed = gbp.filter(isOwed);
    return {
      requested: gbp.reduce((s, r) => s + r.amountPence, 0),
      paid: gbp.filter((r) => r.state === "paid").reduce((s, r) => s + r.amountPence, 0),
      owed: owed.reduce((s, r) => s + r.amountPence, 0),
      owedCount: owed.length,
      noLink: owed.filter((r) => r.state === "no_link").length,
    };
  }, [rows]);

  const counts = useMemo(
    () => ({
      owed: rows.filter(isOwed).length,
      paid: rows.filter((r) => r.state === "paid").length,
      all: rows.length,
    }),
    [rows],
  );

  async function chaseBooking(r: Row) {
    if (!r.bookingId) return;
    setChasing(r.id);
    try {
      const res = await fetch(`/api/bookings/${r.bookingId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send: true }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; alreadyPaid?: boolean; to?: string };
      if (!res.ok) throw new Error(d.error ?? "Couldn't send the link.");
      setChased((m) => ({
        ...m,
        [r.id]: d.alreadyPaid
          ? { ok: true, text: "They've actually paid — now marked paid." }
          : { ok: true, text: `Payment link emailed to ${d.to ?? r.clientEmail}.` },
      }));
      void load();
    } catch (err) {
      setChased((m) => ({
        ...m,
        [r.id]: { ok: false, text: err instanceof Error ? err.message : "Couldn't send the link." },
      }));
    } finally {
      setChasing(null);
    }
  }

  async function markPaid(r: Row) {
    setMarkBusy(true);
    try {
      const paidAt = new Date(`${markDate}T12:00:00`).toISOString();
      const res =
        r.source === "invoice"
          ? await fetch(`/api/invoices/${r.invoiceId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "paid", paidMethod: markMethod, paidAt }),
            })
          : await fetch(`/api/bookings/${r.bookingId}/mark-paid`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ method: markMethod, paidAt }),
            });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Couldn't mark it paid.");
      setMarking(null);
      setChased((m) => ({ ...m, [r.id]: { ok: true, text: "Marked paid." } }));
      await load();
    } catch (err) {
      setChased((m) => ({ ...m, [r.id]: { ok: false, text: err instanceof Error ? err.message : "Couldn't mark it paid." } }));
    } finally {
      setMarkBusy(false);
    }
  }

  async function undoPaid(r: Row) {
    setMarkBusy(true);
    try {
      const res =
        r.source === "invoice"
          ? await fetch(`/api/invoices/${r.invoiceId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "sent" }),
            })
          : await fetch(`/api/bookings/${r.bookingId}/mark-paid`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Couldn't undo that.");
      setChased((m) => ({ ...m, [r.id]: { ok: true, text: "Back to owed." } }));
      await load();
    } catch (err) {
      setChased((m) => ({ ...m, [r.id]: { ok: false, text: err instanceof Error ? err.message : "Couldn't undo that." } }));
    } finally {
      setMarkBusy(false);
    }
  }

  function downloadCsv() {
    const header = [
      "Requested", "Type", "Client", "Email", "For", "Reference", "Amount", "Currency",
      "Status", "Paid on", "Paid by", "Due / appointment",
    ];
    const lines = filtered.map((r) =>
      [
        day(r.requestedAt),
        SOURCE_LABEL[r.source],
        r.clientName,
        r.clientEmail,
        r.description,
        r.reference,
        (r.amountPence / 100).toFixed(2),
        r.currency,
        r.state === "paid" ? "Paid" : r.state === "unfinished" ? "Checkout not finished" : r.state === "no_link" ? "Owed - no link sent" : "Owed",
        r.paidAt ? day(r.paidAt) : null,
        r.paidMethod ? (METHOD_LABEL[r.paidMethod] ?? r.paidMethod) : null,
        r.dueDate ? day(r.dueDate) : null,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payment-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const kpis = [
    { label: "Requested", value: money(totals.requested), foot: `${counts.all} requests`, accent: false },
    { label: "Paid", value: money(totals.paid), foot: `${counts.paid} paid`, accent: false },
    {
      label: "Outstanding",
      value: money(totals.owed),
      foot:
        totals.noLink > 0
          ? `${totals.owedCount} to chase · ${totals.noLink} never sent a link`
          : `${totals.owedCount} to chase`,
      accent: totals.owed > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
      </div>

      <Toolbar
        title="Payment requests"
        help="payment-requests"
        subtitle="Everything we've asked clients to pay — invoices, booking payment links and course checkouts"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/payments"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
              title="Money that has actually landed in Fire"
            >
              <Landmark className="h-4 w-4" />
              Payments received
            </Link>
            <button
              type="button"
              data-help="payment-requests-csv"
              onClick={downloadCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>
        }
      />

      {loading ? (
        <Panel>
          <Empty>Loading payment requests…</Empty>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className={`ds-kpi ${k.accent ? "accent" : ""}`}>
                <div className="ds-kpi-head">
                  <span className="ds-kpi-label">{k.label}</span>
                </div>
                <span className="ds-kpi-value ds-tabular">{k.value}</span>
                <div className="ds-kpi-foot">
                  <span>{k.foot}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2" data-help="payment-requests-filter">
              <div className="inline-flex rounded-xl border border-border bg-card p-1 text-sm">
                {(
                  [
                    ["owed", "Outstanding"],
                    ["paid", "Paid"],
                    ["all", "All"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setShow(v)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-colors",
                      show === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                    <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", show === v ? "bg-white/25" : "bg-muted")}>
                      {counts[v]}
                    </span>
                  </button>
                ))}
              </div>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Source | "all")}
                className="h-9 rounded-xl border border-border bg-card px-3 text-sm"
              >
                <option value="all">All types</option>
                <option value="invoice">Invoices</option>
                <option value="booking">Bookings</option>
                <option value="course">Courses</option>
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by client, email, reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Panel footer={<span>Showing {filtered.length} of {rows.length}</span>}>
            {filtered.length === 0 ? (
              <Empty>{show === "owed" ? "Nothing outstanding — everything asked for has been paid." : "Nothing matches."}</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Requested</th>
                      <th>Client</th>
                      <th>For</th>
                      <th>Reference</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const Icon = SOURCE_ICON[r.source];
                      const note = chased[r.id];
                      return (
                        <tr key={r.id} style={{ cursor: "default" }}>
                          <td className="ds-tabular" style={{ whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>
                            {day(r.requestedAt)}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.clientName}</div>
                            <div className="text-xs text-muted-foreground">{r.clientEmail}</div>
                          </td>
                          <td>
                            <span className="inline-flex items-start gap-1.5">
                              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <Link href={r.href} className="hover:underline">
                                {r.description}
                              </Link>
                            </span>
                          </td>
                          <td className="text-xs text-muted-foreground" style={{ whiteSpace: "nowrap" }}>
                            {r.reference ?? "—"}
                          </td>
                          <td className="ds-tabular" style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {money(r.amountPence, r.currency)}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {r.state === "paid" ? (
                              <div>
                                <Chip tone="success">Paid</Chip>
                                {(r.paidAt || r.paidMethod) && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {r.paidAt ? day(r.paidAt) : ""}
                                    {r.paidMethod && r.paidMethod !== "fire" ? ` · ${METHOD_LABEL[r.paidMethod] ?? r.paidMethod}` : ""}
                                  </div>
                                )}
                              </div>
                            ) : r.state === "unfinished" ? (
                              <Chip tone="neutral">Checkout not finished</Chip>
                            ) : (
                              <div>
                                <Chip tone={r.state === "no_link" ? "danger" : "warn"}>
                                  {r.state === "no_link" ? "Owed — no link sent" : "Owed"}
                                </Chip>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {daysAgo(r.requestedAt)} days since requested
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                            {isOwed(r) && r.source === "booking" && (
                              <button
                                type="button"
                                data-help="payment-requests-chase"
                                disabled={chasing !== null}
                                onClick={() => chaseBooking(r)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                              >
                                {chasing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                                {r.state === "no_link" ? "Send payment link" : "Chase"}
                              </button>
                            )}
                            {isOwed(r) && r.source === "invoice" && (
                              <Link
                                href={r.href}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Open to resend
                              </Link>
                            )}
                            {canMark && isOwed(r) && r.source !== "course" && marking !== r.id && (
                              <button
                                type="button"
                                data-help="payment-requests-mark-paid"
                                onClick={() => {
                                  setMarking(r.id);
                                  setMarkMethod("bank_transfer");
                                  setMarkDate(new Date().toISOString().slice(0, 10));
                                }}
                                className="ml-1.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Mark paid
                              </button>
                            )}
                            {marking === r.id && (
                              <div className="mt-2 inline-flex flex-wrap items-center justify-end gap-1.5 rounded-lg border border-border bg-muted/40 p-2 text-xs">
                                <select
                                  value={markMethod}
                                  onChange={(e) => setMarkMethod(e.target.value)}
                                  className="h-7 rounded-md border border-border bg-background px-1.5"
                                  aria-label="How it was paid"
                                >
                                  {MANUAL_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {METHOD_LABEL[m]}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="date"
                                  value={markDate}
                                  max={new Date().toISOString().slice(0, 10)}
                                  onChange={(e) => setMarkDate(e.target.value)}
                                  className="h-7 rounded-md border border-border bg-background px-1.5"
                                  aria-label="Date paid"
                                />
                                <button
                                  type="button"
                                  disabled={markBusy}
                                  onClick={() => markPaid(r)}
                                  className="h-7 rounded-md bg-emerald-600 px-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {markBusy ? "Saving…" : "Save"}
                                </button>
                                <button type="button" onClick={() => setMarking(null)} className="h-7 px-1.5 text-muted-foreground hover:text-foreground">
                                  Cancel
                                </button>
                              </div>
                            )}
                            {canMark && r.state === "paid" && r.paidMethod && r.paidMethod !== "fire" && r.source !== "course" && (
                              <button
                                type="button"
                                disabled={markBusy}
                                onClick={() => undoPaid(r)}
                                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                                title="Recorded by mistake? Put it back to owed."
                              >
                                Undo
                              </button>
                            )}
                            {note && (
                              <div className={`mt-1 max-w-[220px] whitespace-normal text-xs ${note.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
                                {note.text}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
