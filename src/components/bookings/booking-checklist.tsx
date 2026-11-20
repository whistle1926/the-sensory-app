"use client";

/**
 * Checklist inside the booking popup (Claire, Nov 2026): has the referral
 * form come back, and has it been paid? Payments that came in another way
 * (e.g. a direct bank transfer) can be ticked off here with "Mark as paid".
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, MinusCircle, Loader2 } from "lucide-react";

interface Checklist {
  referral: {
    state: "returned" | "not_needed" | "sent" | "not_sent" | "switched_off";
    at: string | null;
    reminderAt: string | null;
    href: string | null;
  };
  payment: {
    free: boolean;
    paid: boolean;
    paidAt: string | null;
    method: string | null;
    totalPence: number;
    sessions: number;
  };
  canMarkPaid: boolean;
}

const METHOD_LABEL: Record<string, string> = {
  fire: "paid online (Fire)",
  bank_transfer: "bank transfer",
  cash: "cash",
  card: "card",
  other: "other",
};

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Mark({ state }: { state: "done" | "todo" | "na" }) {
  if (state === "done") return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Done" />;
  if (state === "na") return <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="Not needed" />;
  return <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-label="Not done yet" />;
}

export function BookingChecklist({
  bookingId,
  clientName,
  paymentActions,
  onChange,
}: {
  bookingId: string;
  clientName: string;
  /** "Email payment link" / "Copy link" buttons, shown while unpaid. */
  paymentActions?: ReactNode;
  onChange?: (next: { paymentStatus?: string; status?: string; referralNotNeeded?: boolean }) => void;
}) {
  const [data, setData] = useState<Checklist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [method, setMethod] = useState("bank_transfer");
  const [paidOn, setPaidOn] = useState(todayKey());
  const [receipt, setReceipt] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/bookings/${bookingId}/checklist`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData(await r.json());
      setError(null);
    } catch {
      setError("Couldn't load the checklist.");
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markPaid() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, paidAt: new Date(`${paidOn}T12:00:00`).toISOString(), sendReceipt: receipt }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: d.error ?? "Couldn't mark it paid." });
      } else {
        setFormOpen(false);
        setMsg({ ok: true, text: d.receiptSent ? "Marked paid — receipt emailed." : "Marked paid." });
        onChange?.({ paymentStatus: "paid", status: "confirmed" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function undoPaid() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/mark-paid`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ ok: false, text: d.error ?? "Couldn't undo." });
      else {
        onChange?.({ paymentStatus: "unpaid" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function setNotNeeded(notNeeded: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notNeeded }),
      });
      if (r.ok) {
        onChange?.({ referralNotNeeded: notNeeded });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!data)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border p-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading checklist…
      </div>
    );

  const { referral, payment } = data;
  const refMark = referral.state === "returned" ? "done" : referral.state === "not_needed" || referral.state === "switched_off" ? "na" : "todo";
  const refText = {
    returned: `Returned ${shortDate(referral.at)}`,
    not_needed: "Marked not needed",
    sent: `Sent ${shortDate(referral.at)} — not back yet${referral.reminderAt ? ` · reminder sent ${shortDate(referral.reminderAt)}` : ""}`,
    not_sent: "Not sent yet — goes out once the booking is paid",
    switched_off: "Not sent for this service",
  }[referral.state];

  const payMark = payment.free ? "na" : payment.paid ? "done" : "todo";
  const total = `£${(payment.totalPence / 100).toFixed(2)}`;
  const payText = payment.free
    ? "No payment needed"
    : payment.paid
      ? `Paid ${shortDate(payment.paidAt)}${payment.method ? ` · ${METHOD_LABEL[payment.method] ?? payment.method}` : ""}`
      : `Not paid yet — ${total}${payment.sessions > 1 ? ` for all ${payment.sessions} sessions` : ""}`;

  return (
    <div data-help="booking-checklist" className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist</p>

      {/* Referral form */}
      <div className="flex items-start gap-2.5">
        <Mark state={refMark} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Referral form</p>
          <p className="text-xs text-muted-foreground">
            {refText}
            {referral.href && (
              <>
                {" · "}
                <Link href={referral.href} className="font-medium text-primary hover:underline">
                  View
                </Link>
              </>
            )}
          </p>
          {referral.state !== "returned" && (
            <label data-help="booking-referral-not-needed" className="mt-1.5 flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={referral.state === "not_needed"}
                disabled={busy}
                onChange={(e) => setNotNeeded(e.target.checked)}
              />
              <span>
                Not needed for {clientName}
                <span className="block text-muted-foreground">Stops the form, its reminder and the &ldquo;still outstanding&rdquo; alert on all their bookings.</span>
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Payment */}
      <div className="flex items-start gap-2.5 border-t border-border pt-3">
        <Mark state={payMark} />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <div>
            <p className="font-medium">Payment</p>
            <p className="text-xs text-muted-foreground">{payText}</p>
          </div>

          {!payment.free && !payment.paid && (
            <>
              {paymentActions}
              {data.canMarkPaid && !formOpen && (
                <button
                  type="button"
                  data-help="booking-mark-paid"
                  onClick={() => setFormOpen(true)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Mark as paid (bank transfer, cash…)
                </button>
              )}
              {formOpen && (
                <div data-help="booking-mark-paid" className="space-y-2 rounded-xl bg-muted/50 p-3 text-xs">
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="mb-1 block font-medium">How was it paid?</span>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full rounded-lg border border-border bg-card px-2 py-1.5"
                      >
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="flex-1">
                      <span className="mb-1 block font-medium">Date received</span>
                      <input
                        type="date"
                        value={paidOn}
                        max={todayKey()}
                        onChange={(e) => setPaidOn(e.target.value)}
                        className="w-full rounded-lg border border-border bg-card px-2 py-1.5"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />
                    Email {clientName} a receipt
                  </label>
                  {payment.sessions > 1 && (
                    <p className="text-muted-foreground">This marks all {payment.sessions} sessions in the block as paid ({total}).</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={markPaid}
                      className="flex-1 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Mark paid"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="rounded-lg border border-border px-3 py-1.5 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {payment.paid && data.canMarkPaid && payment.method && payment.method !== "fire" && (
            <button type="button" disabled={busy} onClick={undoPaid} className="text-xs font-medium text-muted-foreground underline hover:text-foreground">
              Undo — mark as not paid
            </button>
          )}
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>{msg.text}</p>}
        </div>
      </div>
    </div>
  );
}
