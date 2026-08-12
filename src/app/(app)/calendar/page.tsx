"use client";

/**
 * Team Calendar — aggregated view of every connected staff member's
 * Google Calendar (read-only ICS feed model).
 *
 * Two views:
 *   - Month  — a Google-style month grid (default). Easiest way to see
 *              at a glance whether a connected calendar is pulling
 *              events through.
 *   - Agenda — the original day-grouped list.
 *
 * Each member's events come from their saved iCal URL on their profile,
 * colour-coded by person. Member chips toggle people on/off.
 */
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link as LinkIcon,
  Loader2,
  MapPin,
  RotateCcw,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Toolbar, Panel, Empty } from "@/components/ds";
import { AddEventDialog } from "@/components/calendar/add-event-dialog";

interface Member {
  id: string;
  name: string;
  colour: string;
  connected: boolean;
  /** Removed from this calendar for everyone (not just this browser). */
  hidden?: boolean;
}

interface TeamEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  userId: string;
  userName: string;
  userColour: string;
}

type View = "month" | "agenda";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- date helpers ---------- */
function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** The Sunday on/before the given date — top-left of the month grid. */
function startOfWeekSun(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState<View>("month");

  // Month view anchor (first of the displayed month).
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  // Agenda view start + span (days). Quick buttons set these to today
  // (1 day) or this week (7 days); the plain Agenda toggle uses 14.
  const [agendaFrom, setAgendaFrom] = useState<Date>(today);
  const [agendaSpan, setAgendaSpan] = useState<number>(14);

  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // Bumped after adding an event so the window refetches and the new
  // entry appears without a manual reload.
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  // Claire needs to put time in the OTs' diaries, not just her own.
  const canPickPerson =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "TEAM_MANAGER";

  /** Jump to a focused agenda window. */
  function showAgenda(span: number, from: Date) {
    setView("agenda");
    setAgendaFrom(from);
    setAgendaSpan(span);
  }

  // The 42-cell month grid (6 weeks) covering the anchored month.
  const gridStart = useMemo(() => startOfWeekSun(startOfMonth(monthAnchor)), [monthAnchor]);
  const gridDays = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  // The fetch window depends on the active view.
  const [windowFrom, windowTo] = useMemo<[Date, Date]>(() => {
    if (view === "month") return [gridStart, addDays(gridStart, 42)];
    return [agendaFrom, addDays(agendaFrom, agendaSpan)];
  }, [view, gridStart, agendaFrom, agendaSpan]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      from: windowFrom.toISOString(),
      to: windowTo.toISOString(),
    });
    fetch(`/api/team-calendar/events?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { events: TeamEvent[]; members: Member[] }) => {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setMembers(Array.isArray(data.members) ? data.members : []);
      })
      .catch(() => {
        setEvents([]);
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [windowFrom, windowTo, refreshKey]);

  /**
   * Take an event back out of Google. The API refuses anything attached to a
   * booking and says so — that has to be cancelled under Bookings instead.
   */
  async function removeEvent() {
    if (!selectedEvent) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch("/api/team-calendar/event", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent.uid,
          userId: selectedEvent.userId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoveError(json.error || "Couldn't remove that event.");
        return;
      }
      setSelectedEvent(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setRemoveError("Couldn't reach the server. Try again.");
    } finally {
      setRemoving(false);
    }
  }

  /**
   * Take someone off the shared calendar for everyone — not the same as the
   * chip toggle, which only hides them in this browser. Their connection and
   * their own booking sync are untouched.
   */
  async function setMemberShown(id: string, show: boolean) {
    try {
      const res = await fetch("/api/team-calendar/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, show }),
      });
      if (res.ok) setRefreshKey((k) => k + 1);
    } catch {
      /* leave the list as it is — the next refresh will show the truth */
    }
  }

  function toggleMember(id: string) {
    setHiddenMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleEvents = useMemo(
    () => events.filter((e) => !hiddenMemberIds.has(e.userId)),
    [events, hiddenMemberIds],
  );

  // Events keyed by their start day (YYYY-MM-DD).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, TeamEvent[]>();
    for (const e of visibleEvents) {
      const day = isoDay(new Date(e.startAt));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      });
    }
    return map;
  }, [visibleEvents]);

  const agendaGroups = useMemo(
    () => [...eventsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [eventsByDay],
  );

  const connectedCount = members.filter((m) => m.connected).length;
  const todayKey = isoDay(new Date());
  const monthLabel = monthAnchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  /* ---------- nav ---------- */
  function goPrev() {
    if (view === "month") {
      setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    } else {
      setAgendaFrom((f) => addDays(f, -14));
    }
  }
  function goNext() {
    if (view === "month") {
      setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    } else {
      setAgendaFrom((f) => addDays(f, 14));
    }
  }
  function goToday() {
    setMonthAnchor(startOfMonth(new Date()));
    setAgendaFrom(today);
    setSelectedDay(null);
  }

  const selectedDayEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];

  // The day's events used to render in a panel under the month grid, which
  // is below the fold on most screens — clicking a day, or "+2 more", looked
  // like a dead button. Two attempts at scrolling the panel into view failed
  // (the app shell's scroll container silently reverts programmatic scrolls),
  // so the day now opens as a popup over the grid, like the event detail
  // already does. Nothing to scroll, nothing to miss.

  return (
    <div className="space-y-6">
      {/* People land here wondering why the calendar is empty or why their
          Google events are missing — put the guide right where they look. */}
      <a
        href={connectedCount === 0 ? "/help/calendars/setup" : "/help/calendars"}
        className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-primary/[0.04] p-4 transition hover:bg-primary/[0.08]"
      >
        <span>
          <span className="block text-sm font-bold">
            {connectedCount === 0
              ? "Your calendar isn't connected yet — here's how, step by step"
              : "Not sure how this connects to Google? Read the guide"}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {connectedCount === 0
              ? "Takes about 5 minutes on a computer, and you only do it once."
              : "What's automatic, what needs a click, and why Google events can lag."}
          </span>
        </span>
        <span className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
          {connectedCount === 0 ? "Show me how" : "Open guide"}
        </span>
      </a>

      <Toolbar
        title="Team Calendar"
        subtitle={
          connectedCount === 0
            ? "Nobody has connected a calendar yet — visit Settings → Calendar."
            : `${connectedCount} member${connectedCount === 1 ? "" : "s"} connected · ${visibleEvents.length} event${visibleEvents.length === 1 ? "" : "s"} in view`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add event
            </button>
            {/* View toggle */}
            <div className="mr-1 inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              {(["month", "agenda"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                    view === v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
              title={view === "month" ? "Previous month" : "Previous 2 weeks"}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Today
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
              title={view === "month" ? "Next month" : "Next 2 weeks"}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {/* Quick-view buttons — fast jumps without hunting the nav. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => showAgenda(1, today)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === "agenda" && agendaSpan === 1
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          Today&apos;s agenda
        </button>
        <button
          type="button"
          onClick={() => showAgenda(7, startOfWeekSun(today))}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === "agenda" && agendaSpan === 7
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          This week&apos;s agenda
        </button>
        <button
          type="button"
          onClick={() => {
            setView("month");
            setMonthAnchor(startOfMonth(new Date()));
          }}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === "month"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          Month view
        </button>
      </div>

      {/* Member chips */}
      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
          <span className="mr-2 text-xs font-medium text-muted-foreground">Showing:</span>
          {members
            .filter((m) => !m.hidden)
            .map((m) => {
              const hidden = hiddenMemberIds.has(m.id);
              return (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 text-xs font-medium transition-all ${
                    hidden
                      ? "border-border text-muted-foreground/60"
                      : "border-border text-foreground"
                  } ${!m.connected ? "opacity-40" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    disabled={!m.connected}
                    className={`inline-flex items-center gap-1.5 ${hidden ? "line-through" : ""}`}
                    title={m.connected ? "Click to hide / show just for you" : "Not connected yet"}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.colour }} />
                    {m.name}
                    {!m.connected && (
                      <span className="text-[10px] uppercase tracking-wider">· off</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberShown(m.id, false)}
                    aria-label={`Remove ${m.name} from the team calendar`}
                    title="Remove from the team calendar for everyone"
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

          {members.some((m) => m.hidden) && (
            <span className="mt-1 flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
              Removed from this calendar:
              {members
                .filter((m) => m.hidden)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMemberShown(m.id, true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 font-medium hover:bg-muted/40"
                    title="Put them back on the team calendar"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {m.name}
                  </button>
                ))}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <Panel padded>
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading calendar…
          </div>
        </Panel>
      ) : connectedCount === 0 ? (
        <Panel padded>
          <Empty>
            <CalendarDays className="mx-auto h-7 w-7 opacity-40" />
            <p className="mt-2 font-semibold">No calendars connected yet.</p>
            <p className="mt-1 text-xs">
              Head to{" "}
              <Link href="/settings?tab=calendar" className="text-primary underline">
                Settings → Calendar
              </Link>{" "}
              to paste your Google Calendar&apos;s secret iCal URL.
            </p>
          </Empty>
        </Panel>
      ) : view === "month" ? (
        <>
          {/* ── Month grid ───────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
            {/* Month label */}
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-base font-bold">{monthLabel}</h2>
            </div>
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {w}
                </div>
              ))}
            </div>
            {/* 6 weeks × 7 days */}
            <div className="grid grid-cols-7">
              {gridDays.map((day) => {
                const key = isoDay(day);
                const inMonth = day.getMonth() === monthAnchor.getMonth();
                const isToday = key === todayKey;
                const dayEvents = eventsByDay.get(key) ?? [];
                const shown = dayEvents.slice(0, 3);
                const extra = dayEvents.length - shown.length;
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(key)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelectedDay(key);
                      }
                    }}
                    className={`min-h-[96px] cursor-pointer border-b border-r border-border/60 p-1.5 text-left align-top transition-colors hover:bg-muted/30 ${
                      inMonth ? "bg-card" : "bg-muted/20"
                    } ${selectedDay === key ? "ring-2 ring-inset ring-primary/40" : ""}`}
                  >
                    <div className="mb-1 flex justify-end">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : inMonth
                              ? "text-foreground"
                              : "text-muted-foreground/50"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {shown.map((e) => (
                        <button
                          key={`${e.userId}:${e.uid}`}
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedEvent(e);
                          }}
                          className="flex w-full items-center gap-1 truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] font-medium text-foreground hover:brightness-95"
                          style={{
                            // Light tint for identity, with a solid colour
                            // stripe — but the TEXT stays dark so any member
                            // colour (incl. amber/yellow) is readable.
                            background: `${e.userColour}1f`,
                            borderColor: e.userColour,
                          }}
                          title={`${e.title} — ${e.userName}`}
                        >
                          <span className="truncate">
                            {!e.allDay && (
                              <span className="tabular-nums text-muted-foreground">
                                {formatTime(e.startAt)}{" "}
                              </span>
                            )}
                            {e.title || "(untitled)"}
                          </span>
                        </button>
                      ))}
                      {extra > 0 && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedDay(key);
                          }}
                          className="px-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          +{extra} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </>
      ) : /* ── Agenda view ────────────────────────────────────────── */
      agendaGroups.length === 0 ? (
        <Panel padded>
          <Empty>
            <CalendarDays className="mx-auto h-7 w-7 opacity-40" />
            <p className="mt-2 font-semibold">No events in this window.</p>
            <p className="mt-1 text-xs">
              Try the Month view, step the dates, or check the filter chips above.
            </p>
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-4">
          {agendaGroups.map(([day, dayEvents]) => {
            const d = new Date(`${day}T00:00:00`);
            const isToday = todayKey === day;
            return (
              <Panel
                key={day}
                title={
                  <span className="flex items-center gap-2">
                    {formatDayHeader(d)}
                    {isToday && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Today
                      </span>
                    )}
                  </span>
                }
                subtitle={`${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
              >
                <div className="divide-y divide-border">
                  {dayEvents.map((e) => (
                    <EventRow key={`${e.userId}:${e.uid}`} event={e} onClick={() => setSelectedEvent(e)} />
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Event detail modal — opened by clicking any event chip / row. */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: selectedEvent.userColour }}
                />
                <h3 className="text-base font-bold leading-snug">
                  {selectedEvent.title || "(untitled event)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedEvent(null); setRemoveError(null); }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground">
                  {new Date(selectedEvent.startAt).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground">
                  {selectedEvent.allDay
                    ? "All day"
                    : `${formatTime(selectedEvent.startAt)} – ${formatTime(selectedEvent.endAt)}`}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-foreground">{selectedEvent.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-foreground"
                  style={{ background: `${selectedEvent.userColour}1f` }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: selectedEvent.userColour }}
                  />
                  {selectedEvent.userName}
                </span>
              </div>
              {selectedEvent.description && (
                <div className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
                  {selectedEvent.description}
                </div>
              )}
            </div>

            {removeError && (
              <p className="mt-4 rounded-xl border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                {removeError}
              </p>
            )}

            {/* Only offered where we can actually act: an iCal-only calendar
                is read-only, and a non-admin can only touch their own. */}
            {(canPickPerson || selectedEvent.userId === currentUserId) && (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={removeEvent}
                  disabled={removing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                >
                  {removing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove from calendar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected-day popup — opened by clicking a day cell or "+N more". */}
      {selectedDay && !selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="text-base font-bold leading-snug">
                  {formatDayHeader(new Date(`${selectedDay}T00:00:00`))}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedDayEvents.length} event
                  {selectedDayEvents.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nothing on this day.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {selectedDayEvents.map((e) => (
                    <EventRow
                      key={`${e.userId}:${e.uid}`}
                      event={e}
                      onClick={() => setSelectedEvent(e)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add an event on this day
              </button>
            </div>
          </div>
        </div>
      )}

      <AddEventDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => setRefreshKey((k) => k + 1)}
        members={members}
        currentUserId={currentUserId}
        canPickPerson={canPickPerson}
        defaultDate={selectedDay ?? undefined}
      />
    </div>
  );
}

function EventRow({ event: e, onClick }: { event: TeamEvent; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/20"
    >
      <div
        className="mt-1 h-10 w-1 shrink-0 rounded-full"
        style={{ background: e.userColour }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {e.title || "(untitled event)"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3" />
            {e.allDay ? "All day" : `${formatTime(e.startAt)} – ${formatTime(e.endAt)}`}
          </span>
          {e.location && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{e.location}</span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-foreground"
            style={{ background: `${e.userColour}1f` }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: e.userColour }}
            />
            {e.userName}
          </span>
        </div>
        {e.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
            {e.description}
          </p>
        )}
      </div>
      <LinkIcon className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/30" />
    </button>
  );
}
