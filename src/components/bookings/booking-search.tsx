"use client";

/**
 * Search box for the Bookings and Team calendars. Type a client name,
 * email, phone or service; pick a result to jump to that booking.
 */
import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";

export interface BookingSearchResult {
  id: string;
  day: string; // YYYY-MM-DD (UK calendar day)
  time: string;
  service: string;
  clientName: string;
  clientEmail: string;
  status: string;
  paymentStatus: string;
  sessionIndex: number | null;
  upcoming: boolean;
}

function prettyDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BookingSearch({
  onPick,
  className,
}: {
  onPick: (r: BookingSearchResult) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BookingSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/bookings/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const d = await r.json();
        setResults(Array.isArray(d.results) ? d.results : []);
        setTotal(typeof d.total === "number" ? d.total : 0);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close when clicking elsewhere.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} data-help="booking-search" className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results[0]) {
              onPick(results[0]);
              setOpen(false);
            }
          }}
          placeholder="Search bookings — client name, email, phone or service"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search bookings"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-border bg-card shadow-[var(--shadow-md)]">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No bookings match &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r, i) => {
                const firstPast = !r.upcoming && (i === 0 || results[i - 1].upcoming);
                return (
                  <li key={r.id}>
                    {i === 0 && r.upcoming && (
                      <p className="bg-muted/40 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</p>
                    )}
                    {firstPast && (
                      <p className="bg-muted/40 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Past</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onPick(r);
                        setOpen(false);
                      }}
                      className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.clientName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.service}
                          {r.sessionIndex ? ` · session ${r.sessionIndex}` : ""} · {r.clientEmail}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-medium">{prettyDay(r.day)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.time}
                          {r.status === "cancelled" ? " · cancelled" : r.paymentStatus !== "paid" ? " · unpaid" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {total > results.length && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Showing {results.length} of {total} — type more to narrow it down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
