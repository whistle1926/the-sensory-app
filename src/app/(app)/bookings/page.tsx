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
  Plus,
  Trash2,
  Ban,
  Mail,
  ScrollText,
  PoundSterling,
} from "lucide-react";
import { Toolbar } from "@/components/ds";
import { AutomationsSection } from "@/components/bookings/automations-section";
import { TermsSection } from "@/components/bookings/terms-section";
import { ServicesSection } from "@/components/bookings/services-section";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Interval {
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  intervals: Interval[];
}

interface DateOverrideRecord {
  id: string;
  date: string;
  available: boolean;
  intervals: Interval[] | null;
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
const DAY_NAMES_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const HOUR_LABELS = [
  "08:00 AM", "09:00", "10:00", "11:00", "12:00 PM",
  "01:00", "02:00", "03:00", "04:00", "05:00",
];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// Time options for dropdowns (every 15 minutes from 06:00 to 21:00)
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
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

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type Tab =
  | "calendar"
  | "availability"
  | "automations"
  | "terms"
  | "services";

export default function BookingsPage() {
  const today = useMemo(() => new Date(), []);

  const [tab, setTab] = useState<Tab>("calendar");
  const [copied, setCopied] = useState(false);

  // Calendar state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Schedule state
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleChanged, setScheduleChanged] = useState(false);

  // Date overrides state
  const [overrides, setOverrides] = useState<DateOverrideRecord[]>([]);
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideType, setNewOverrideType] = useState<"unavailable" | "custom">("unavailable");
  const [newOverrideStart, setNewOverrideStart] = useState("09:00");
  const [newOverrideEnd, setNewOverrideEnd] = useState("17:00");

  // Computed availability for calendar view
  const [computedSlots, setComputedSlots] = useState<Record<string, string[]>>({});

  // Selected booking detail
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const bookingLink = typeof window !== "undefined" ? `${window.location.origin}/book` : "/book";
  const monthYear = selectedDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  /* ------ Fetchers ------ */
  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) setBookings(await res.json());
    } catch { /* silent */ }
    setLoadingBookings(false);
  }, []);

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const res = await fetch("/api/availability/schedule");
      if (res.ok) setSchedule(await res.json());
    } catch { /* silent */ }
    setLoadingSchedule(false);
  }, []);

  const fetchOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/availability/overrides");
      if (res.ok) setOverrides(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchComputedSlots = useCallback(async () => {
    const from = weekDays[0].toISOString().split("T")[0];
    const to = weekDays[6].toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/availability?from=${from}&to=${to}`);
      if (res.ok) setComputedSlots(await res.json());
    } catch { /* silent */ }
  }, [weekDays]);

  useEffect(() => {
    fetchBookings();
    fetchSchedule();
    fetchOverrides();
  }, [fetchBookings, fetchSchedule, fetchOverrides]);

  useEffect(() => {
    fetchComputedSlots();
  }, [fetchComputedSlots]);

  /* ------ Copy link ------ */
  function handleCopy() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ------ Schedule editing ------ */
  function toggleDay(day: number) {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day]?.enabled,
        intervals: prev[day]?.intervals?.length ? prev[day].intervals : [{ start: "09:00", end: "17:00" }],
      },
    }));
    setScheduleChanged(true);
  }

  function updateInterval(day: number, idx: number, field: "start" | "end", value: string) {
    setSchedule((prev) => {
      const daySchedule = { ...prev[day] };
      const intervals = [...daySchedule.intervals];
      intervals[idx] = { ...intervals[idx], [field]: value };
      return { ...prev, [day]: { ...daySchedule, intervals } };
    });
    setScheduleChanged(true);
  }

  function addInterval(day: number) {
    setSchedule((prev) => {
      const daySchedule = { ...prev[day] };
      const lastEnd = daySchedule.intervals.length
        ? daySchedule.intervals[daySchedule.intervals.length - 1].end
        : "09:00";
      // Start new interval 30 min after last end
      const [h, m] = lastEnd.split(":").map(Number);
      const startMins = h * 60 + m + 30;
      const endMins = startMins + 120;
      const newStart = `${String(Math.floor(startMins / 60)).padStart(2, "0")}:${String(startMins % 60).padStart(2, "0")}`;
      const newEnd = `${String(Math.min(Math.floor(endMins / 60), 21)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
      return { ...prev, [day]: { ...daySchedule, intervals: [...daySchedule.intervals, { start: newStart, end: newEnd }] } };
    });
    setScheduleChanged(true);
  }

  function removeInterval(day: number, idx: number) {
    setSchedule((prev) => {
      const daySchedule = { ...prev[day] };
      const intervals = daySchedule.intervals.filter((_, i) => i !== idx);
      return { ...prev, [day]: { ...daySchedule, intervals, enabled: intervals.length > 0 ? daySchedule.enabled : false } };
    });
    setScheduleChanged(true);
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/availability/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (res.ok) {
        setSchedule(await res.json());
        setScheduleChanged(false);
        fetchComputedSlots();
      }
    } catch { /* silent */ }
    setSavingSchedule(false);
  }

  /* ------ Date override actions ------ */
  async function addOverride() {
    if (!newOverrideDate) return;
    try {
      const res = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newOverrideDate,
          available: newOverrideType === "custom",
          intervals: newOverrideType === "custom" ? [{ start: newOverrideStart, end: newOverrideEnd }] : null,
        }),
      });
      if (res.ok) {
        fetchOverrides();
        fetchComputedSlots();
        setNewOverrideDate("");
      }
    } catch { /* silent */ }
  }

  async function removeOverride(id: string) {
    try {
      const res = await fetch(`/api/availability/overrides?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchOverrides();
        fetchComputedSlots();
      }
    } catch { /* silent */ }
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

  /* ------ Day helpers ------ */
  function getBookingsForDay(day: Date) {
    return bookings
      .filter((b) => isSameDay(new Date(b.date), day) && b.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getAvailForDay(day: Date): string[] {
    const dateKey = day.toISOString().split("T")[0];
    return computedSlots[dateKey] || [];
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
      <Toolbar
        title="Bookings"
        subtitle="Manage your calendar, availability, and client bookings"
      />

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
        <button
          onClick={() => setTab("automations")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "automations" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="mr-2 inline h-4 w-4" />
          Automations
        </button>
        <button
          onClick={() => setTab("terms")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "terms" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScrollText className="mr-2 inline h-4 w-4" />
          Terms
        </button>
        <button
          onClick={() => setTab("services")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "services" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <PoundSterling className="mr-2 inline h-4 w-4" />
          Services
        </button>
      </div>

      {/* ================================================================ */}
      {/*  AUTOMATIONS TAB                                                  */}
      {/* ================================================================ */}
      {tab === "automations" && <AutomationsSection />}

      {/* ================================================================ */}
      {/*  TERMS TAB                                                        */}
      {/* ================================================================ */}
      {tab === "terms" && <TermsSection />}

      {/* ================================================================ */}
      {/*  SERVICES TAB                                                     */}
      {/* ================================================================ */}
      {tab === "services" && <ServicesSection />}

      {/* ================================================================ */}
      {/*  CALENDAR TAB                                                     */}
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
            <span className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white">Daily</span>
          </div>

          {/* Week day selector */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day, i) => {
              const isSelected = isSameDay(day, selectedDay);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center gap-0.5 py-3 transition-all ${
                    isSelected ? "bg-primary text-white" : "hover:bg-muted/50"
                  }`}
                >
                  <span className={`text-[11px] font-medium ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {DAY_NAMES_FULL[day.getDay()]}
                  </span>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                      isSelected ? "text-white" : isToday ? "ring-2 ring-primary/40 text-primary" : ""
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
            {loadingBookings ? (
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
                    <div key={hour} className="flex min-h-[80px] border-b border-border/40">
                      <div className="flex w-20 shrink-0 items-start justify-end pr-4 pt-3">
                        <span className="text-xs font-medium text-muted-foreground">{HOUR_LABELS[idx]}</span>
                      </div>
                      <div className="flex-1 border-l border-border/40 py-2 pr-4">
                        {booking ? (
                          <BookingCard booking={booking} onClick={() => setSelectedBooking(booking)} />
                        ) : isAvail ? (
                          <div className="ml-3 mb-1 flex h-8 items-center rounded-lg border border-dashed border-green-300 bg-green-50/50 px-3 dark:border-green-800 dark:bg-green-950/20">
                            <span className="text-[11px] text-green-600 dark:text-green-400">{timeStr} — Available</span>
                          </div>
                        ) : null}

                        {bookingHalf ? (
                          <BookingCard booking={bookingHalf} onClick={() => setSelectedBooking(bookingHalf)} />
                        ) : isAvailHalf ? (
                          <div className="ml-3 mt-1 flex h-8 items-center rounded-lg border border-dashed border-green-300 bg-green-50/50 px-3 dark:border-green-800 dark:bg-green-950/20">
                            <span className="text-[11px] text-green-600 dark:text-green-400">{timeHalf} — Available</span>
                          </div>
                        ) : null}
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
      {/*  AVAILABILITY TAB — CALENDLY STYLE                                */}
      {/* ================================================================ */}
      {tab === "availability" && (
        <div className="space-y-6">
          {/* Weekly Hours */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold">Set your weekly hours</h3>
              {scheduleChanged && (
                <Button onClick={saveSchedule} disabled={savingSchedule} className="rounded-xl">
                  {savingSchedule ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {savingSchedule ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Set the times you are available for bookings each week
            </p>

            {loadingSchedule ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const day = schedule[d] || { enabled: false, intervals: [] };
                  return (
                    <div key={d} className="flex items-start gap-4 py-4">
                      {/* Toggle + Day name */}
                      <div className="flex items-center gap-3 w-32 shrink-0 pt-1.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={day.enabled}
                          onClick={() => toggleDay(d)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            day.enabled ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              day.enabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className={`text-sm font-semibold ${day.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                          {DAY_NAMES_SHORT[d]}
                        </span>
                      </div>

                      {/* Intervals or Unavailable */}
                      <div className="flex-1">
                        {!day.enabled ? (
                          <p className="text-sm text-muted-foreground pt-1.5">Unavailable</p>
                        ) : (
                          <div className="space-y-2">
                            {day.intervals.map((iv, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <select
                                  value={iv.start}
                                  onChange={(e) => updateInterval(d, idx, "start", e.target.value)}
                                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  {TIME_OPTIONS.map((t) => (
                                    <option key={t} value={t}>{formatTime12(t)}</option>
                                  ))}
                                </select>
                                <span className="text-sm text-muted-foreground">—</span>
                                <select
                                  value={iv.end}
                                  onChange={(e) => updateInterval(d, idx, "end", e.target.value)}
                                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  {TIME_OPTIONS.map((t) => (
                                    <option key={t} value={t}>{formatTime12(t)}</option>
                                  ))}
                                </select>

                                {day.intervals.length > 1 && (
                                  <button
                                    onClick={() => removeInterval(d, idx)}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {idx === day.intervals.length - 1 && (
                                  <button
                                    onClick={() => addInterval(d)}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {day.intervals.length === 0 && (
                              <button
                                onClick={() => addInterval(d)}
                                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add hours
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date-specific overrides */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
            <h3 className="text-base font-semibold">Date-specific overrides</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Override your availability for specific dates. These take priority over your weekly hours.
            </p>

            {/* Existing overrides */}
            {overrides.length > 0 && (
              <div className="space-y-2 mb-5">
                {overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${o.available ? "bg-green-100 dark:bg-green-950/40" : "bg-red-100 dark:bg-red-950/40"}`}>
                        {o.available ? (
                          <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(o.date + "T00:00:00").toLocaleDateString("en-GB", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {o.available && o.intervals
                            ? (o.intervals as Interval[]).map((iv) => `${formatTime12(iv.start)} — ${formatTime12(iv.end)}`).join(", ")
                            : "Unavailable"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeOverride(o.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new override */}
            <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={newOverrideDate}
                    onChange={(e) => setNewOverrideDate(e.target.value)}
                    className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select
                    value={newOverrideType}
                    onChange={(e) => setNewOverrideType(e.target.value as "unavailable" | "custom")}
                    className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="unavailable">Unavailable</option>
                    <option value="custom">Custom hours</option>
                  </select>
                </div>
                {newOverrideType === "custom" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">From</label>
                      <select
                        value={newOverrideStart}
                        onChange={(e) => setNewOverrideStart(e.target.value)}
                        className="flex h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{formatTime12(t)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">To</label>
                      <select
                        value={newOverrideEnd}
                        onChange={(e) => setNewOverrideEnd(e.target.value)}
                        className="flex h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{formatTime12(t)}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <Button onClick={addOverride} disabled={!newOverrideDate} variant="outline" className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Override
                </Button>
              </div>
            </div>
          </div>
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
                    {new Date(selectedBooking.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
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
        <p className="text-xs text-muted-foreground mt-0.5">{SERVICE_SHORT[booking.service] || booking.service}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{booking.time}–{endTime}</span>
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
