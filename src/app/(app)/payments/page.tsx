"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Loader2, Landmark } from "lucide-react";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

interface ReceivedPayment {
  txnId: number;
  date: string;
  amountPence: number;
  currency: string;
  reference: string | null;
  description: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  amountMatches: boolean;
}
interface FireAccount {
  ican: number;
  name: string;
  currency: string;
  balance: number;
  status?: string;
}
interface Result {
  configured: boolean;
  accounts: FireAccount[];
  payments: ReceivedPayment[];
  error?: string;
}

function money(pence: number, cur = "GBP"): string {
  return (pence / 100).toLocaleString("en-GB", { style: "currency", currency: cur });
}
function majorMoney(amount: number, cur = "GBP"): string {
  return amount.toLocaleString("en-GB", { style: "currency", currency: cur });
}
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentsReceivedPage() {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch("/api/payments/received", { cache: "no-store" });
      const d = (await r.json()) as Result;
      setData(d);
    } catch {
      setData({ configured: true, accounts: [], payments: [], error: "Couldn't reach Fire." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalReceived =
    data?.payments.reduce((sum, p) => sum + (p.currency === "GBP" ? p.amountPence : 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
      </div>

      <Toolbar
        title="Payments received"
        subtitle="Real money that has landed in your Fire account — the source of truth"
        actions={
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh from Fire"}
          </button>
        }
      />

      {loading ? (
        <Panel>
          <Empty>Loading payments from Fire…</Empty>
        </Panel>
      ) : !data?.configured ? (
        <Panel>
          <Empty>
            Fire isn&apos;t connected yet. Add your Fire API key in Settings to
            see payments that have landed.
          </Empty>
        </Panel>
      ) : data.error ? (
        <Panel>
          <Empty>Couldn&apos;t reach Fire: {data.error}</Empty>
        </Panel>
      ) : (
        <>
          {/* Account balances — live from Fire */}
          {data.accounts.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.accounts.map((a) => (
                <div key={a.ican} className="ds-kpi">
                  <div className="ds-kpi-head">
                    <span className="ds-kpi-label">{a.name}</span>
                    <span className="ds-kpi-icon">
                      <Landmark className="h-4 w-4" />
                    </span>
                  </div>
                  <span className="ds-kpi-value ds-tabular">
                    {majorMoney(a.balance, a.currency)}
                  </span>
                  <div className="ds-kpi-foot">
                    <span>
                      {a.currency} · ICAN {a.ican}
                      {a.status ? ` · ${a.status.toLowerCase()}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Panel>
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">
                Money received{" "}
                <span className="text-muted-foreground">
                  ({data.payments.length})
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Only payments that have actually landed in Fire appear here.
                {totalReceived > 0 && (
                  <> Total received (GBP): {money(totalReceived)}.</>
                )}
              </p>
            </div>

            {data.payments.length === 0 ? (
              <Empty>No payments have landed in Fire yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-2 font-semibold">Received</th>
                      <th className="px-5 py-2 font-semibold">Amount</th>
                      <th className="px-5 py-2 font-semibold">For invoice</th>
                      <th className="px-5 py-2 font-semibold">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.txnId} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                          {when(p.date)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 font-semibold text-green-700 dark:text-green-400">
                          + {money(p.amountPence, p.currency)}
                        </td>
                        <td className="px-5 py-2.5">
                          {p.invoiceId ? (
                            <span className="inline-flex items-center gap-2">
                              <Link
                                href={`/invoices/${p.invoiceId}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {p.invoiceNumber}
                              </Link>
                              {p.clientName && (
                                <span className="text-muted-foreground">
                                  {p.clientName}
                                </span>
                              )}
                              {!p.amountMatches && (
                                <Chip tone="warn">amount differs</Chip>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Not linked to an invoice
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {p.reference || p.description || "—"}
                        </td>
                      </tr>
                    ))}
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
