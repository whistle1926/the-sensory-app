"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function statusBadge(status: string, paymentStatus: string) {
  if (status === "cancelled") {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
        Cancelled
      </span>
    );
  }
  if (paymentStatus === "paid") {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
        Paid
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
      Unpaid
    </span>
  );
}

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
        const data = await res.json().catch(() => ({ error: "Could not cancel" }));
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={loadBookings} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your upcoming and past sessions with The Sensory Submarine
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h2 className="mt-4 text-base font-semibold">No bookings yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Book your first session to get started.</p>
          <Link
            href="/book"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Book a session
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{b.service}</h3>
                          {statusBadge(b.status, b.paymentStatus)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(b.date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {b.time}
                          </span>
                          <span className="text-xs">{formatPrice(b.price)}</span>
                        </div>
                      </div>
                      {b.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b.id)}
                        >
                          {cancellingId === b.id ? "Cancelling..." : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Past ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-border/60 bg-card/50 p-5 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{b.service}</h3>
                          {statusBadge(b.status, b.paymentStatus)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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

          <div>
            <Link
              href="/book"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              Book another session
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
