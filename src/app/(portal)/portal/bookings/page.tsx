"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, Clock, Loader2 } from "lucide-react";

interface PortalBooking {
  id: string;
  service: string;
  date: string; // ISO
  time: string;
  duration: string;
  price: number;
  status: string;
  paymentStatus: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

const PILL_BASE =
  "inline-flex items-center rounded-full border-2 px-3 py-1 text-[13px] font-bold";

function statusChip(status: string, paymentStatus: string) {
  if (status === "cancelled")
    return (
      <span className={`${PILL_BASE} border-[#FBC7D7] bg-[#FFE7EE] text-[#B81243]`}>
        Cancelled
      </span>
    );
  if (paymentStatus === "paid")
    return (
      <span className={`${PILL_BASE} border-[#C2E7E3] bg-[#E7F6F4]`}>Paid</span>
    );
  return (
    <span className={`${PILL_BASE} border-[#F3DFA6] bg-[#FFF3D2]`}>Unpaid</span>
  );
}

// The coloured date tile rotates through the three brand accents so a
// list of sessions reads as a row of Submarine cards, not a table.
const TILE_COLOURS = ["#17B0A7", "#E71D57", "#FFC93C"] as const;

function DateTile({ iso, index }: { iso: string; index: number }) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { day: "numeric" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const colour = TILE_COLOURS[index % TILE_COLOURS.length];
  const onYellow = colour === "#FFC93C";
  return (
    <span
      className={`flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[18px] border-[3px] border-[#12235B] leading-none ${
        onYellow ? "text-[#12235B]" : "text-white"
      }`}
      style={{ backgroundColor: colour }}
      aria-hidden
    >
      <span className="sub-display text-[26px]">{day}</span>
      <span className="text-[11px] font-extrabold uppercase tracking-[1px]">
        {month}
      </span>
    </span>
  );
}

/**
 * Portal — my bookings. Parent-facing view of their own upcoming / past
 * sessions. Wears the Submarine treatment.
 */
export default function PortalBookingsPage() {
  const [bookings, setBookings] = useState<PortalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/bookings");
      if (!res.ok) {
        setError("Could not load bookings");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  async function handleCancel(id: string) {
    const ok = window.confirm("Cancel this booking? This cannot be undone.");
    if (!ok) return;

    setCancellingId(id);
    try {
      const res = await fetch(`/api/portal/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Could not cancel" }));
        alert(data.error || "Could not cancel this booking");
        setCancellingId(null);
        return;
      }
      await loadBookings();
    } catch {
      alert("Network error. Please try again.");
    }
    setCancellingId(null);
  }

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: PortalBooking[] = [];
    const pa: PortalBooking[] = [];
    for (const b of bookings) {
      const t = new Date(b.date).getTime();
      if (t >= now - 24 * 60 * 60 * 1000) up.push(b);
      else pa.push(b);
    }
    up.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    pa.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { upcoming: up, past: pa };
  }, [bookings]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#E71D57]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <AlertCircle className="h-10 w-10 text-[#E71D57]" />
        <p className="rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3.5 text-sm font-bold text-[#B81243]">
          {error}
        </p>
        <button
          type="button"
          onClick={loadBookings}
          className="sub-press rounded-full border-[3px] border-[#12235B] bg-white px-5 py-2.5 font-extrabold text-[#12235B]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page head ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[44px]">
            My Bookings
          </h1>
          <p className="mt-1 text-base font-semibold text-[#6B7794]">
            Your upcoming and past sessions with The Sensory Submarine
          </p>
        </div>
        <Link
          href="/book"
          className="sub-edge sub-press inline-flex items-center justify-center gap-2 self-start rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white sm:self-auto"
          style={{ background: "var(--sub-pink)" }}
        >
          Book a session
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="sub-edge rounded-[26px] bg-white p-7 text-center">
          <span className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[18px] border-[3px] border-[#12235B] bg-[#FFC93C]">
            <Calendar className="h-7 w-7 text-[#12235B]" />
          </span>
          <p className="sub-display mt-4 text-2xl">No bookings yet</p>
          <p className="mt-1 text-[15px] font-semibold text-[#6B7794]">
            Book your first session to get started.
          </p>
          <Link
            href="/book"
            className="sub-edge sub-press mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
            style={{ background: "var(--sub-pink)" }}
          >
            Book a session
          </Link>
        </div>
      ) : (
        <>
          {/* ── Upcoming ──────────────────────────────────────────── */}
          <section>
            <h2 className="sub-display text-2xl">
              Upcoming{" "}
              <span className="text-[#6B7794]">&middot; {upcoming.length}</span>
            </h2>
            <p className="mb-4 mt-0.5 text-[15px] font-semibold text-[#6B7794]">
              {upcoming.length === 0
                ? "Nothing coming up"
                : "Sessions on the way"}
            </p>

            {upcoming.length === 0 ? (
              <div className="rounded-[26px] border-[3px] border-dashed border-[#D9D2C4] bg-[#FFFCF6] px-6 py-8 text-center text-[15px] font-semibold text-[#6B7794]">
                No upcoming bookings.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {upcoming.map((b, i) => (
                  <div
                    key={b.id}
                    className="sub-edge rounded-[26px] bg-white p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <DateTile iso={b.date} index={i} />
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="sub-display text-[22px] leading-tight">
                              {b.service}
                            </h3>
                            {statusChip(b.status, b.paymentStatus)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-semibold text-[#3D4A6B]">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-[#6B7794]" />
                              {formatDate(b.date)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-[#6B7794]" />
                              {b.time}
                            </span>
                            <span className="font-bold text-[#E71D57]">
                              {formatPrice(b.price)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {b.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b.id)}
                          className="sub-press self-start rounded-full border-[3px] border-[#B81243] bg-white px-5 py-2.5 text-sm font-extrabold text-[#B81243] hover:bg-[#FFE7EE] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
                        >
                          {cancellingId === b.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Past ──────────────────────────────────────────────── */}
          {past.length > 0 && (
            <section>
              <h2 className="sub-display text-2xl">
                Past{" "}
                <span className="text-[#6B7794]">&middot; {past.length}</span>
              </h2>
              <p className="mb-4 mt-0.5 text-[15px] font-semibold text-[#6B7794]">
                Your session history
              </p>
              <div className="flex flex-col gap-4">
                {past.map((b, i) => (
                  <div
                    key={b.id}
                    className="rounded-[26px] border-[3px] border-[#D9D2C4] bg-white p-5 opacity-80 sm:p-6"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <DateTile iso={b.date} index={i} />
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="sub-display text-[22px] leading-tight">
                            {b.service}
                          </h3>
                          {statusChip(b.status, b.paymentStatus)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-semibold text-[#3D4A6B]">
                          <span>{formatDate(b.date)}</span>
                          <span>{b.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
