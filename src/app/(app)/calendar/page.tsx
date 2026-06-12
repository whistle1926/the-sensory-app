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
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link as LinkIcon,
  Loader2,
  MapPin,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { Toolbar, Panel, Empty } from "@/components/ds";

interface Member {
  id: string;
  name: string;
  colour: string;
  connected: boolean;
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
  }, [windowFrom, windowTo]);

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

  return (
    <div className="space-y-6">
      <Toolbar
        title="Team Calendar"
        subtitle={
          connectedCount === 0
            ? "Nobody has connected a calendar yet — visit Settings → Calendar."
            : `${connectedCount} member${connectedCount === 1 ? "" : "s"} connected · ${visibleEvents.length} event${visibleEvents.length === 1 ? "" : "s"} in view`
        }
        actions={
          <div className="flex items-center gap-2">
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
          {members.map((m) => {
            const hidden = hiddenMemberIds.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMember(m.id)}
                disabled={!m.connected}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  hidden
                    ? "border-border text-muted-foreground/60 line-through"
                    : "border-border text-foreground hover:bg-muted/40"
                } ${!m.connected ? "opacity-40" : ""}`}
                title={m.connected ? "Click to hide / show" : "Not connected yet"}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.colour }} />
                {m.name}
                {!m.connected && (
                  <span className="text-[10px] uppercase tracking-wider">· off</span>
                )}
              </button>
            );
          })}
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

          {/* Selected-day detail */}
          {selectedDay && (
            <Panel
              title={formatDayHeader(new Date(`${selectedDay}T00:00:00`))}
              subtitle={`${selectedDayEvents.length} event${selectedDayEvents.length === 1 ? "" : "s"}`}
            >
              {selectedDayEvents.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No events on this day.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedDayEvents.map((e) => (
                    <EventRow key={`${e.userId}:${e.uid}`} event={e} onClick={() => setSelectedEvent(e)} />
                  ))}
                </div>
              )}
            </Panel>
          )}
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
                onClick={() => setSelectedEvent(null)}
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
          </div>
        </div>
      )}
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
