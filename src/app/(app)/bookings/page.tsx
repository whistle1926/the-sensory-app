"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { localDateKey, londonDateKey } from "@/lib/date-key";
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

/** A Google Calendar event (from /api/team-calendar/events) overlaid on
 * the bookings calendar so the diary reflects real appointments. */
interface IcsCalEvent {
  uid: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
  userId: string;
  userName: string;
  userColour: string;
}

/** Minimal service shape needed for the availability service picker. */
interface ManageableService {
  id: string;
  slug: string;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
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

/**
 * Does a booking fall on the given grid-cell day? Booking `date` is stored
 * as the London calendar day's midnight (23:00 UTC the night before in BST),
 * so we compare its Europe/London day-key against the cell's local day-key.
 * This shows the booking on the day staff intended, in any viewer timezone —
 * unlike a plain local isSameDay, which drifts a day outside the UK.
 */
function bookingIsOnDay(bookingDate: Date, day: Date) {
  return londonDateKey(bookingDate) === localDateKey(day);
}

/** The 42 days (6 weeks) of the month-view grid containing `anchor` —
 * starting on the Sunday on/before the 1st of that month. */
function monthGridDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = getWeekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
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
  const { data: session } = useSession();
  const role = session?.user?.role;
  const myId = session?.user?.id;
  const isAdmin = role === "SUPER_ADMIN";

  const [tab, setTab] = useState<Tab>("calendar");
  const [copied, setCopied] = useState(false);

  // ── Availability service scope ──────────────────────────────────
  // Availability is now per-service. Admins also get a "Default"
  // option (the global calendar that unassigned services inherit);
  // associates only ever see/edit their own services. `availService`
  // is the slug being edited, or null for the admin Default calendar.
  const [manageableServices, setManageableServices] = useState<ManageableService[]>([]);
  // Every service (not owner-scoped) — used by the "New booking" form so
  // staff can book a client onto ANY service, even ones they don't own.
  const [allServices, setAllServices] = useState<ManageableService[]>([]);
  const [availService, setAvailService] = useState<string | null>(null);
  const [availServiceReady, setAvailServiceReady] = useState(false);

  // Calendar state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  // Calendar tab view mode. Month is the default — it's the at-a-glance
  // diary; Day drills into a single day's timeline.
  const [calView, setCalView] = useState<"month" | "day">("month");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  // The signed-in user's own Google Calendar events, overlaid on the
  // Calendar tab so the diary isn't empty when appointments live in
  // Google rather than as portal bookings.
  const [icsEvents, setIcsEvents] = useState<IcsCalEvent[]>([]);

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

  /* ------ Manual ("new") booking from the dashboard ------ */
  const [nbOpen, setNbOpen] = useState(false);
  const [nbSaving, setNbSaving] = useState(false);
  const [nbError, setNbError] = useState<string | null>(null);
  const [nb, setNb] = useState({
    service: "",
    date: "",
    time: "",
    duration: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    notes: "",
  });
  // Existing-client typeahead for the name field.
  type ClientHit = { id: string; childName: string; parentName: string; parentEmail: string };
  const [nbHits, setNbHits] = useState<ClientHit[]>([]);
  const [nbHitsOpen, setNbHitsOpen] = useState(false);
  useEffect(() => {
    const q = nb.clientName.trim();
    if (!nbOpen || !nbHitsOpen || q.length < 2) {
      setNbHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
        if (!r.ok) {
          setNbHits([]); // 403 for restricted users → just free-text
          return;
        }
        const d = (await r.json()) as { results?: ClientHit[] };
        setNbHits(d.results ?? []);
      } catch {
        setNbHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [nb.clientName, nbOpen, nbHitsOpen]);

  function pickClient(hit: ClientHit) {
    setNb((prev) => ({
      ...prev,
      clientName: hit.parentName || hit.childName,
      clientEmail: hit.parentEmail || prev.clientEmail,
    }));
    setNbHitsOpen(false);
    setNbHits([]);
  }

  async function submitNewBooking() {
    setNbError(null);
    if (!nb.service || !nb.date || !nb.time || !nb.clientName.trim() || !nb.clientEmail.trim()) {
      setNbError("Service, date, time, client name and email are all required.");
      return;
    }
    setNbSaving(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: nb.service,
          // Stored as a Date — send midnight UTC of the chosen day so it
          // matches how the public flow records dates.
          date: new Date(`${nb.date}T00:00:00`).toISOString(),
          time: nb.time,
          duration: nb.duration,
          clientName: nb.clientName.trim(),
          clientEmail: nb.clientEmail.trim(),
          clientPhone: nb.clientPhone.trim() || undefined,
          notes: nb.notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Booking failed (${res.status})`);
      }
      setNbOpen(false);
      setNb({ service: "", date: "", time: "", duration: "", clientName: "", clientEmail: "", clientPhone: "", notes: "" });
      await fetchBookings();
    } catch (e) {
      setNbError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setNbSaving(false);
    }
  }

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

  // The month currently in focus (stable per month so we don't refetch
  // the calendar feeds on every day-click).
  const monthKey = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}`;

  // Pull connected Google Calendar events for the whole visible month grid
  // and overlay them on the calendar — so it shows the real diary, not
  // just portal bookings. Covers both the month grid and the day view.
  const fetchIcsEvents = useCallback(async () => {
    const [y, m] = monthKey.split("-").map(Number);
    const grid = monthGridDays(new Date(y, m, 1));
    const from = grid[0].toISOString();
    const end = new Date(grid[41]);
    end.setHours(23, 59, 59, 999);
    try {
      const res = await fetch(
        `/api/team-calendar/events?from=${encodeURIComponent(
          from,
        )}&to=${encodeURIComponent(end.toISOString())}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { events?: IcsCalEvent[] };
        const all = Array.isArray(data.events) ? data.events : [];
        // Show every connected staff calendar — this is the practice
        // diary. (We deliberately don't filter to the signed-in user:
        // the same person can have more than one admin login, and the
        // calendar may be connected to a different one of them.)
        setIcsEvents(all);
      }
    } catch { /* silent */ }
  }, [monthKey]);

  useEffect(() => {
    fetchIcsEvents();
  }, [fetchIcsEvents]);

  // Query-string fragment scoping availability calls to the chosen
  // service (empty = the admin Default calendar).
  const availServiceQ = availService
    ? `?service=${encodeURIComponent(availService)}`
    : "";

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const q = availService ? `?service=${encodeURIComponent(availService)}` : "";
      const res = await fetch(`/api/availability/schedule${q}`);
      if (res.ok) setSchedule(await res.json());
    } catch { /* silent */ }
    setLoadingSchedule(false);
  }, [availService]);

  const fetchOverrides = useCallback(async () => {
    try {
      const q = availService ? `?service=${encodeURIComponent(availService)}` : "";
      const res = await fetch(`/api/availability/overrides${q}`);
      if (res.ok) setOverrides(await res.json());
    } catch { /* silent */ }
  }, [availService]);

  const fetchComputedSlots = useCallback(async () => {
    const from = localDateKey(weekDays[0]);
    const to = localDateKey(weekDays[6]);
    try {
      const res = await fetch(`/api/availability?from=${from}&to=${to}`);
      if (res.ok) setComputedSlots(await res.json());
    } catch { /* silent */ }
  }, [weekDays]);

  // Load the services this user may manage, and pick a sensible default
  // selection (admins → Default calendar; associates → their first
  // service). Runs once the session is known.
  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/booking-services?all=1");
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          id: string;
          slug: string;
          title: string;
          ownerId: string | null;
          ownerName: string | null;
        }>;
        if (cancelled) return;
        const shape = (r: (typeof rows)[number]) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          ownerId: r.ownerId,
          ownerName: r.ownerName,
        });
        // Owner-scoped list for the availability editor (you manage your
        // own service's calendar); the full list for the booking form.
        const mine = isAdmin ? rows : rows.filter((r) => r.ownerId === myId);
        setManageableServices(mine.map(shape));
        setAllServices(rows.map(shape));
        // Initial selection: admins start on the Default calendar (null);
        // associates start on their first owned service.
        setAvailService(isAdmin ? null : (mine[0]?.slug ?? null));
        setAvailServiceReady(true);
      } catch {
        setAvailServiceReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, isAdmin, myId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // (Re)load schedule + overrides whenever the chosen service changes.
  // Skip for associates who have no service selected yet (they'd hit a
  // 403 on the Default calendar).
  useEffect(() => {
    if (!availServiceReady) return;
    if (!isAdmin && !availService) return;
    fetchSchedule();
    fetchOverrides();
  }, [availServiceReady, isAdmin, availService, fetchSchedule, fetchOverrides]);

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
      const res = await fetch(`/api/availability/schedule${availServiceQ}`, {
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
      const res = await fetch(`/api/availability/overrides${availServiceQ}`, {
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
      .filter((b) => bookingIsOnDay(new Date(b.date), day) && b.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getAvailForDay(day: Date): string[] {
    const dateKey = localDateKey(day);
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

  // Header prev/next — step by month in month view, by week in day view.
  function prevPeriod() {
    if (calView === "month") setSelectedDay(addMonths(selectedDay, -1));
    else prevWeek();
  }
  function nextPeriod() {
    if (calView === "month") setSelectedDay(addMonths(selectedDay, 1));
    else nextWeek();
  }

  // Merged, time-sorted list of everything on a day (portal bookings +
  // Google events) — used to fill the month-grid cells.
  function dayAgenda(day: Date): Array<{
    key: string;
    time: string;
    label: string;
    kind: "booking" | "google";
  }> {
    const items: Array<{
      key: string;
      time: string;
      label: string;
      kind: "booking" | "google";
    }> = [];
    for (const b of bookings) {
      if (bookingIsOnDay(new Date(b.date), day) && b.status !== "cancelled") {
        items.push({
          key: `b-${b.id}`,
          time: b.time,
          label: `${b.time} ${b.clientName}`,
          kind: "booking",
        });
      }
    }
    for (const e of icsEvents) {
      if (isSameDay(new Date(e.startAt), day)) {
        const t = e.allDay
          ? ""
          : new Date(e.startAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            });
        items.push({
          key: `g-${e.uid}`,
          time: e.allDay ? "00:00" : t,
          label: e.allDay ? e.title : `${t} ${e.title}`,
          kind: "google",
        });
      }
    }
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }

  const dayBookings = getBookingsForDay(selectedDay);
  const dayAvail = getAvailForDay(selectedDay);
  // Google Calendar events on the selected day. Timed events that fall
  // inside the visible grid (08:00–17:00) sit in their hour row; all-day
  // events and anything outside those hours show in a strip on top so
  // nothing is hidden.
  const dayIcsEvents = icsEvents.filter((e) =>
    isSameDay(new Date(e.startAt), selectedDay),
  );
  const isInGridHour = (e: IcsCalEvent) =>
    !e.allDay && HOURS.includes(new Date(e.startAt).getHours());
  const dayIcsOther = dayIcsEvents.filter((e) => !isInGridHour(e));
  const isWeekend = selectedDay.getDay() === 0 || selectedDay.getDay() === 6;

  return (
    <div className="space-y-6">
      <Toolbar
        title="Bookings"
        help="bookings"
        subtitle="Manage your calendar, availability, and client bookings"
        actions={
          <Button
            data-help="bookings-new"
            onClick={() => {
              setNbError(null);
              setNbOpen(true);
            }}
            className="rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            New booking
          </Button>
        }
      />

      {/* Booking Link Card */}
      <div
        data-help="bookings-share-link"
        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
      >
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
          data-help="bookings-tab-calendar"
          onClick={() => setTab("calendar")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "calendar" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className="mr-2 inline h-4 w-4" />
          Calendar
        </button>
        <button
          data-help="bookings-tab-availability"
          onClick={() => setTab("availability")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "availability" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="mr-2 inline h-4 w-4" />
          Availability
        </button>
        <button
          data-help="bookings-tab-automations"
          onClick={() => setTab("automations")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "automations" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="mr-2 inline h-4 w-4" />
          Automations
        </button>
        <button
          data-help="bookings-tab-terms"
          onClick={() => setTab("terms")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "terms" ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScrollText className="mr-2 inline h-4 w-4" />
          Terms
        </button>
        <button
          data-help="bookings-tab-services"
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
                <button onClick={prevPeriod} className="rounded-lg p-1 hover:bg-muted transition-colors" aria-label="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={nextPeriod} className="rounded-lg p-1 hover:bg-muted transition-colors" aria-label="Next">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setSelectedDay(today)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
              >
                Today
              </button>
            </div>
            {/* Month / Day view toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {(["month", "day"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                    calView === v
                      ? "bg-primary text-white shadow-[var(--shadow-xs)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* ---- MONTH VIEW ---- */}
          {calView === "month" && (
            <div>
              <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                {DAY_NAMES_SHORT.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthGridDays(selectedDay).map((day, i) => {
                  const inMonth = day.getMonth() === selectedDay.getMonth();
                  const isToday = isSameDay(day, today);
                  const agenda = dayAgenda(day);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDay(day);
                        setWeekStart(getWeekStart(day));
                        setCalView("day");
                      }}
                      className={`flex min-h-[104px] flex-col gap-1 border-b border-r border-border/60 p-1.5 text-left transition-colors hover:bg-muted/40 ${
                        inMonth ? "" : "bg-muted/20"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-primary text-white"
                            : inMonth
                              ? "text-foreground"
                              : "text-muted-foreground/50"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {agenda.slice(0, 3).map((it) => (
                          <span
                            key={it.key}
                            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${
                              it.kind === "booking"
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {it.label}
                          </span>
                        ))}
                        {agenda.length > 3 && (
                          <span className="px-1 text-[10px] font-medium text-muted-foreground">
                            +{agenda.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {calView === "day" && (
          <>{/* ---- DAY VIEW (week strip + timeline) ---- */}

          {/* Week day selector */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day, i) => {
              const isSelected = isSameDay(day, selectedDay);
              const isToday = isSameDay(day, today);
              // Does this day have anything on it? Drives a dot under the
              // date so busy days stand out in the daily view (otherwise
              // an empty selected day makes the whole week look blank).
              const hasBooking = bookings.some(
                (b) =>
                  isSameDay(new Date(b.date), day) && b.status !== "cancelled",
              );
              const hasIcs = icsEvents.some((e) =>
                isSameDay(new Date(e.startAt), day),
              );
              const hasActivity = hasBooking || hasIcs;
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
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      hasActivity
                        ? isSelected
                          ? "bg-white"
                          : "bg-primary"
                        : "bg-transparent"
                    }`}
                    aria-hidden
                  />
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
                {/* All-day / out-of-hours Google events — shown on top so
                    nothing is hidden by the 08:00–17:00 grid. */}
                {dayIcsOther.length > 0 && (
                  <div className="border-b border-border/40 bg-muted/20 px-4 py-2.5">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      From your Google Calendar
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dayIcsOther.map((e) => (
                        <IcsEventChip key={e.uid} event={e} />
                      ))}
                    </div>
                  </div>
                )}
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

                        {/* Google Calendar events starting in this hour. */}
                        {dayIcsEvents
                          .filter(
                            (e) =>
                              isInGridHour(e) &&
                              new Date(e.startAt).getHours() === hour,
                          )
                          .map((e) => (
                            <IcsEventChip key={e.uid} event={e} />
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/*  AVAILABILITY TAB — CALENDLY STYLE                                */}
      {/* ================================================================ */}
      {tab === "availability" && !isAdmin && manageableServices.length === 0 && availServiceReady && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
          <Settings2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-semibold">No services assigned to you yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once an admin links a service to you (e.g. your assessment clinic),
            you&apos;ll set its days and times here.
          </p>
        </div>
      )}

      {tab === "availability" &&
        (isAdmin || manageableServices.length > 0) && (
        <div className="space-y-6">
          {/* Service picker — which calendar are we editing? */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <label className="text-sm font-semibold">
              Which service&apos;s availability?
            </label>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Each service has its own days and times. Pick one to edit, then
              set the hours below. Monthly clinics can use date-specific
              overrides instead of weekly hours.
            </p>
            <select
              value={availService ?? ""}
              onChange={(e) => setAvailService(e.target.value || null)}
              className="h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {isAdmin && (
                <option value="">Default (unassigned services)</option>
              )}
              {manageableServices.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.title}
                  {isAdmin && s.ownerName ? ` — ${s.ownerName}` : ""}
                </option>
              ))}
            </select>
          </div>

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

      {/* Manual booking — staff book on a client's behalf (e.g. a phone
          enquiry). Skips the public T&C step server-side. */}
      <Dialog open={nbOpen} onOpenChange={setNbOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nb-service">Service</Label>
              <select
                id="nb-service"
                value={nb.service}
                onChange={(e) => setNb({ ...nb, service: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Choose a service…</option>
                {allServices.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.title}
                    {s.ownerName ? ` — ${s.ownerName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nb-date">Date</Label>
                <Input
                  id="nb-date"
                  type="date"
                  value={nb.date}
                  onChange={(e) => setNb({ ...nb, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-time">Time</Label>
                <Input
                  id="nb-time"
                  type="time"
                  value={nb.time}
                  onChange={(e) => setNb({ ...nb, time: e.target.value })}
                />
              </div>
            </div>
            <div className="relative space-y-1.5">
              <Label htmlFor="nb-name">Client / parent name</Label>
              <Input
                id="nb-name"
                value={nb.clientName}
                autoComplete="off"
                onChange={(e) => {
                  setNb({ ...nb, clientName: e.target.value });
                  setNbHitsOpen(true);
                }}
                onFocus={() => setNbHitsOpen(true)}
                placeholder="Start typing to find an existing client…"
              />
              {nbHitsOpen && nbHits.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
                  {nbHits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => pickClient(h)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">
                          {h.parentName || h.childName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {h.parentName ? `Child: ${h.childName}` : ""}
                          {h.parentEmail ? ` · ${h.parentEmail}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                Pick a match to fill their details, or just type a new client.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nb-email">Email</Label>
                <Input
                  id="nb-email"
                  type="email"
                  value={nb.clientEmail}
                  onChange={(e) => setNb({ ...nb, clientEmail: e.target.value })}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-phone">Phone (optional)</Label>
                <Input
                  id="nb-phone"
                  value={nb.clientPhone}
                  onChange={(e) => setNb({ ...nb, clientPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-notes">Notes (optional)</Label>
              <textarea
                id="nb-notes"
                value={nb.notes}
                onChange={(e) => setNb({ ...nb, notes: e.target.value })}
                rows={2}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {nbError && (
              <p className="text-xs text-red-600 dark:text-red-400">{nbError}</p>
            )}
          </div>
          <div className="-mx-4 -mb-4 mt-1 flex items-center justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3">
            <Button
              variant="outline"
              onClick={() => setNbOpen(false)}
              disabled={nbSaving}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={submitNewBooking} disabled={nbSaving} className="rounded-xl">
              {nbSaving ? "Booking…" : "Create booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Booking Card Component                                             */
/* ------------------------------------------------------------------ */

/** A read-only chip for a Google Calendar event overlaid on the bookings
 * timeline. Tagged "Google" so it's clearly distinct from portal bookings,
 * which are the only thing you can edit/cancel here. */
function IcsEventChip({ event }: { event: IcsCalEvent }) {
  const colour = event.userColour || "#6366f1";
  const timeLabel = event.allDay
    ? "All day"
    : `${new Date(event.startAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}–${new Date(event.endAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
  return (
    <div
      className="ml-3 mb-1 flex w-[calc(100%-12px)] items-start gap-2 rounded-lg border border-border bg-card/70 px-3 py-2"
      style={{ borderLeftColor: colour, borderLeftWidth: 4 }}
      title={`From Google Calendar — ${event.title}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {event.title || "(busy)"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeLabel}</span>
          {event.location && (
            <span className="truncate">· {event.location}</span>
          )}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Google
      </span>
    </div>
  );
}

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
