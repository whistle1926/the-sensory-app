"use client";

/**
 * "Online booking: On / Enquire only" (Claire, Nov 2026). While Enquire only
 * is on, every service on the public booking page — and the parent portal's
 * "Book a session" — shows "Enquire now" instead of the calendar. Staff can
 * still book clients in with New booking. Admins only.
 */
import { useEffect, useState } from "react";
import { MessageSquare, CalendarCheck } from "lucide-react";

export function EnquireOnlySwitch({ canEdit }: { canEdit: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/storefront", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { bookingEnquireOnly?: boolean }) => setOn(d.bookingEnquireOnly === true))
      .catch(() => setOn(false));
  }, []);

  async function set(next: boolean) {
    const ok = window.confirm(
      next
        ? "Switch online booking to ENQUIRE ONLY?\n\nParents will see \"Enquire now\" on every service instead of picking a date, and enquiries will come to admin@. You can still book clients in yourself with New booking."
        : "Turn online booking back ON?\n\nParents will be able to pick a date and book (and pay) again.",
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/settings/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingEnquireOnly: next }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setOn(d.bookingEnquireOnly === true);
    } catch {
      setErr("Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (on === null) return null;

  return (
    <div
      data-help="bookings-enquire-only"
      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 shadow-[var(--shadow-sm)] ${
        on
          ? "border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/20"
          : "border-border bg-card"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          on ? "bg-amber-400 text-amber-950" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}
      >
        {on ? <MessageSquare className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Online booking: {on ? "Enquire only" : "On"}
        </p>
        <p className="text-xs text-muted-foreground">
          {on
            ? "Parents see “Enquire now” on every service instead of booking a date. Enquiries are emailed to admin@. New booking (top right) still works for you."
            : "Parents can pick a date and book on the public booking page and in their portal."}
        </p>
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => set(!on)}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
            on
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "border border-border bg-card hover:bg-muted"
          }`}
        >
          {busy ? "Saving…" : on ? "Turn booking back on" : "Switch to enquire only"}
        </button>
      )}
    </div>
  );
}
