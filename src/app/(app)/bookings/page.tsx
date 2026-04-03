"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Link2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Settings2,
  User,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AvailSlot {
  id: string;
  dayOfWeek: number;
  time: string;
}

interface BookingRecord {
  id: string;
  service: string;
  date: string;
  time: string;
  duration: string;
  price: number;
  clientName: string;
  clientEmail: string;
  status: string;
  paymentStatus: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const HOUR_LABELS = [
  "08:00 AM", "09:00", "10:00", "11:00", "12:00 PM",
  "01:00", "02:00", "03:00", "04:00", "05:00",
];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const ALL_TIMES: string[] = [];
for (let h = 8; h <= 17; h++) {
  ALL_TIMES.push(`${String(h).padStart(2, "0")}:00`);
  ALL_TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

const SERVICE_LABELS: Record<string, string> = {
  "initial-ot": "Initial OT Consultation",
  "follow-up": "Follow-Up Session",
  school: "School Consultation",
  "sensory-eaters": "Sensory Eaters Programme",
};

const SERVICE_SHORT: Record<string, string> = {
  "initial-ot": "Initial OT",
  "follow-up": "Follow-Up",
  school: "School",
  "sensory-eaters": "Sensory Eaters",
};

const SERVICE_COLOURS: Record<string, string> = {
  "initial-ot": "oklch(0.55 0.20 264)",
  "follow-up": "oklch(0.55 0.20 155)",
  school: "oklch(0.60 0.20 55)",
  "sensory-eaters": "oklch(0.55 0.20 310)",
};

const SERVICE_BG: Record<string, string> = {
  "initial-ot": "bg-indigo-50 dark:bg-indigo-950/30",
  "follow-up": "bg-emerald-50 dark:bg-emerald-950/30",
  school: "bg-amber-50 dark:bg-amber-950/30",
  "sensory-eaters": "bg-purple-50 dark:bg-purple-950/30",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getWeekStart(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day;
  const ws = new Date(d);
  ws.setDate(diff);
  ws.setHours(0, 0, 0, 0);
  return ws;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type Tab = "calendar" | "availability";

export default function BookingsPage() {
  const today = useMemo(() => new Date(), []);

  const [tab, setTab] = useState<Tab>("calendar");
  const [copied, setCopied] = useState(false);

  // Calendar state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Availability state
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);

  // Selected booking detail
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const bookingLink = typeof window !== "undefined" ? `${window.location.origin}/book` : "/book";

  // Current month/year display
  const monthYear = selectedDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  /* ------ Fetch bookings ------ */
  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) setBookings(await res.json());
    } catch { /* silent */ }
    setLoadingBookings(false);
  }, []);

  /* ------ Fetch availability ------ */
  const fetchAvailability = useCallback(async () => {
    setLoadingAvail(true);
    try {
      const res = await fetch("/api/availability");
      if (res.ok) setAvailability(await res.json());
    } catch { /* silent */ }
    setLoadingAvail(false);
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchAvailability();
  }, [fetchBookings, fetchAvailability]);

  /* ------ Copy link ------ */
  function handleCopy() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ------ Toggle availability slot ------ */
  async function toggleSlot(dayOfWeek: number, time: string) {
    const current = availability.filter((s) => s.dayOfWeek === dayOfWeek).map((s) => s.time);
    const updated = current.includes(time) ? current.filter((t) => t !== time) : [...current, time].sort();

    setSavingDay(dayOfWeek);
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, slots: updated }),
      });
      if (res.ok) setAvailability(await res.json());
    } catch { /* silent */ }
    setSavingDay(null);
  }

  /* ------ Cancel booking ------ */
  async function handleCancel(bookingId: string) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b)));
        setSelectedBooking(null);
      }
    } catch { /* silent */ }
  }

  /* ------ Day bookings + availability ------ */
  function getBookingsForDay(day: Date) {
    return bookings
      .filter((b) => isSameDay(new Date(b.date), day) && b.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getAvailForDay(day: Date) {
    const jsDay = day.getDay();
    if (jsDay === 0 || jsDay === 6) return [];
    return availability.filter((s) => s.dayOfWeek === jsDay).map((s) => s.time);
  }

  /* ------ Navigate week when selecting a day outside current week ------ */
  function selectDay(day: Date) {
    setSelectedDay(day);
  }

  function prevWeek() {
    const nw = addDays(weekStart, -7);
    setWeekStart(nw);
    setSelectedDay(addDays(selectedDay, -7));
  }

  function nextWeek() {
    const nw = addDays(weekStart, 7);
    setWeekStart(nw);
    setSelectedDay(addDays(selectedDay, 7));
  }

  const dayBookings = getBookingsForDay(selectedDay);
  const dayAvail = getAvailForDay(selectedDay);
  const isWeekend = selectedDay.getDay() === 0 || selectedDay.getDay() === 6;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your calendar, availability, and client bookings</p>
        </div>
      </div>

      {/* Booking Link Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
            <Link2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Shareable Booking Link</h2>
            <p className="text-xs text-muted-foreground">Share this link with clients so they can book a session directly</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-mono text-foreground truncate">
            {bookingLink}
          </div>
          <Button onClick={handleCopy} variant="outline" className="shrink-0 rounded-xl">
            {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        <button
          onClick={() => setTab("calendar")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "calendar" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className="mr-2 inline h-4 w-4" />
          Calendar
        </button>
        <button
          onClick={() => setTab("availability")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "availability" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="mr-2 inline h-4 w-4" />
          Availability
        </button>
      </div>

      {/* ================================================================ */}
      {/*  CALENDAR TAB — DAILY TIMELINE                                    */}
      {/* ================================================================ */}
      {tab === "calendar" && (
        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Month header + nav */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">{monthYear}</h2>
              <div className="flex items-center gap-1">
                <button onClick={prevWeek} className="rounded-lg p-1 hover:bg-muted transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={nextWeek} className="rounded-lg p-1 hover:bg-muted transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
              <span className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white">Daily</span>
            </div>
          </div>

          {/* Week day selector row */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day, i) => {
              const isSelected = isSameDay(day, selectedDay);
              const isToday = isSameDay(day, today);
              const dayName = DAY_NAMES_FULL[day.getDay()];

              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  className={`flex flex-col items-center gap-0.5 py-3 transition-all ${
                    isSelected
                      ? "bg-primary text-white"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className={`text-[11px] font-medium ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {dayName}
                  </span>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                      isSelected
                        ? "text-white"
                        : isToday
                          ? "ring-2 ring-primary/40 text-primary font-bold"
                          : ""
                    }`}
                  >
                    {String(day.getDate()).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Daily timeline */}
          <div className="relative min-h-[600px]" style={{ background: "linear-gradient(180deg, var(--color-card) 0%, oklch(0.97 0.01 264 / 0.3) 100%)" }}>
            {isWeekend ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">Closed on weekends</p>
              </div>
            ) : loadingBookings ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="relative">
                {HOURS.map((hour, idx) => {
                  const timeStr = `${String(hour).padStart(2, "0")}:00`;
                  const timeHalf = `${String(hour).padStart(2, "0")}:30`;
                  const booking = dayBookings.find((b) => b.time === timeStr);
                  const bookingHalf = dayBookings.find((b) => b.time === timeHalf);
                  const isAvail = dayAvail.includes(timeStr);
                  const isAvailHalf = dayAvail.includes(timeHalf);

                  return (
                    <div key={hour}>
                      {/* Hour row */}
                      <div className="flex min-h-[80px] border-b border-border/40">
                        {/* Time label */}
                        <div className="flex w-20 shrink-0 items-start justify-end pr-4 pt-3">
                          <span className="text-xs font-medium text-muted-foreground">{HOUR_LABELS[idx]}</span>
                        </div>

                        {/* Content area */}
                        <div className="flex-1 border-l border-border/40 py-2 pr-4">
                          {/* :00 slot */}
                          {booking ? (
                            <BookingCard booking={booking} onClick={() => setSelectedBooking(booking)} />
                          ) : isAvail ? (
                            <div className="ml-3 mb-1 flex h-8 items-center rounded-lg border border-dashed border-green-300 bg-green-50/50 px-3 dark:border-green-800 dark:bg-green-950/20">
                              <span className="text-[11px] text-green-600 dark:text-green-400">{timeStr} — Available</span>
                            </div>
                          ) : null}

                          {/* :30 slot */}
                          {bookingHalf ? (
                            <BookingCard booking={bookingHalf} onClick={() => setSelectedBooking(bookingHalf)} />
                          ) : isAvailHalf ? (
                            <div className="ml-3 mt-1 flex h-8 items-center rounded-lg border border-dashed border-green-300 bg-green-50/50 px-3 dark:border-green-800 dark:bg-green-950/20">
                              <span className="text-[11px] text-green-600 dark:text-green-400">{timeHalf} — Available</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  AVAILABILITY TAB                                                 */}
      {/* ================================================================ */}
      {tab === "availability" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <h3 className="text-sm font-semibold">Weekly Schedule</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Click time slots to toggle availability. Green slots are open for clients to book.
            </p>
          </div>

          {loadingAvail ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {WEEKDAY_LABELS.map((dayLabel, idx) => {
                const dayOfWeek = idx + 1;
                const daySlots = availability.filter((s) => s.dayOfWeek === dayOfWeek).map((s) => s.time);
                const isSaving = savingDay === dayOfWeek;

                return (
                  <div key={dayOfWeek} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{dayLabel}</h4>
                        {isSaving && <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {daySlots.length} slot{daySlots.length !== 1 ? "s" : ""} open
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_TIMES.filter((t) => t !== "17:30").map((time) => {
                        const isEnabled = daySlots.includes(time);
                        return (
                          <button
                            key={time}
                            onClick={() => toggleSlot(dayOfWeek, time)}
                            disabled={isSaving}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                              isEnabled
                                ? "bg-green-100 text-green-700 ring-1 ring-green-300 dark:bg-green-950/40 dark:text-green-400 dark:ring-green-800"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            } ${isSaving ? "opacity-50 cursor-wait" : ""}`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/*  BOOKING DETAIL MODAL                                             */}
      {/* ================================================================ */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedBooking(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-xl)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Booking Details</h3>
              <button onClick={() => setSelectedBooking(null)} className="rounded-lg p-1 hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: SERVICE_COLOURS[selectedBooking.service] || "oklch(0.55 0.20 264)" }}
                >
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold">{SERVICE_LABELS[selectedBooking.service] || selectedBooking.service}</p>
                  <p className="text-xs text-muted-foreground">{selectedBooking.duration}</p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(selectedBooking.date).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{selectedBooking.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">{"\u00a3"}{(selectedBooking.price / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</span>
                </div>
                <p className="font-medium">{selectedBooking.clientName}</p>
                <p className="text-muted-foreground">{selectedBooking.clientEmail}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[selectedBooking.status] || STATUS_STYLES.pending}`}>
                  {selectedBooking.status}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedBooking.paymentStatus === "paid" ? STATUS_STYLES.confirmed : STATUS_STYLES.pending}`}>
                  {selectedBooking.paymentStatus}
                </span>
              </div>

              {selectedBooking.status !== "cancelled" && (
                <div className="pt-2 border-t border-border">
                  <Button variant="outline" className="w-full rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20" onClick={() => handleCancel(selectedBooking.id)}>
                    Cancel Booking
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Booking Card Component                                             */
/* ------------------------------------------------------------------ */

function BookingCard({ booking, onClick }: { booking: BookingRecord; onClick: () => void }) {
  const dur = durationToMinutes(booking.duration);
  const endTime = addMinutesToTime(booking.time, dur);
  const colour = SERVICE_COLOURS[booking.service] || "oklch(0.55 0.20 264)";
  const bgClass = SERVICE_BG[booking.service] || "bg-indigo-50 dark:bg-indigo-950/30";

  return (
    <button
      onClick={onClick}
      className={`ml-3 mb-1 flex w-[calc(100%-12px)] items-start gap-3 rounded-xl border-l-4 px-4 py-3 text-left transition-all hover:shadow-[var(--shadow-sm)] active:scale-[0.99] ${bgClass}`}
      style={{ borderLeftColor: colour }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{booking.clientName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {SERVICE_SHORT[booking.service] || booking.service}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {booking.time}–{endTime}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            booking.paymentStatus === "paid"
              ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          }`}
        >
          {booking.paymentStatus === "paid" ? "Paid" : "Unpaid"}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: colour }}
        >
          {booking.clientName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
      </div>
    </button>
  );
}

function durationToMinutes(dur: string): number {
  const match = dur.match(/(\d+)\s*minute/i);
  if (match) return parseInt(match[1]);
  return 60;
}

function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
