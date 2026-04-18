"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

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

function statusChip(status: string, paymentStatus: string) {
  if (status === "cancelled") return <Chip tone="danger">Cancelled</Chip>;
  if (paymentStatus === "paid") return <Chip tone="success">Paid</Chip>;
  return <Chip tone="warn">Unpaid</Chip>;
}

/**
 * Portal — my bookings. Parent-facing view of their own upcoming / past
 * sessions. Uses the shared DS vocabulary.
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
    <div className="space-y-6">
      <Toolbar
        title="My Bookings"
        subtitle="Your upcoming and past sessions with The Sensory Submarine"
        actions={
          <Link
            href="/book"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Book a session
          </Link>
        }
      />

      {bookings.length === 0 ? (
        <Panel>
          <div className="ds-empty">
            <Calendar
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No bookings yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Book your first session to get started.
            </p>
            <Link
              href="/book"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Book a session
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <Panel
            title={`Upcoming · ${upcoming.length}`}
            subtitle={
              upcoming.length === 0
                ? "Nothing coming up"
                : "Sessions on the way"
            }
          >
            {upcoming.length === 0 ? (
              <Empty>No upcoming bookings.</Empty>
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map((b) => (
                  <div key={b.id} className="px-5 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {b.service}
                          </h3>
                          {statusChip(b.status, b.paymentStatus)}
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
                          <span className="text-xs">
                            {formatPrice(b.price)}
                          </span>
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
                          {cancellingId === b.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {past.length > 0 && (
            <Panel
              title={`Past · ${past.length}`}
              subtitle="Your session history"
            >
              <div className="divide-y divide-border">
                {past.map((b) => (
                  <div key={b.id} className="px-5 py-4 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {b.service}
                          </h3>
                          {statusChip(b.status, b.paymentStatus)}
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
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
