"use client";

/**
 * Team Calendar — aggregated agenda view of every connected staff
 * member's Google Calendar.
 *
 * Read-only ICS feed model — Patrick chose this for the MVP. Each
 * member's events come from their saved iCal URL on their profile.
 * Defaults to "next 14 days" but the user can step weeks forward
 * and backward. Events are grouped by day with a small colour chip
 * for the owning person.
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

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Roll the window forward/backward by `days` days, anchored on today. */
function shiftWindow(from: Date, to: Date, days: number): { from: Date; to: Date } {
  return {
    from: new Date(from.getTime() + days * 86_400_000),
    to: new Date(to.getTime() + days * 86_400_000),
  };
}

export default function CalendarPage() {
  // Default window: today → +13 (= two clear weeks of agenda).
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [from, setFrom] = useState<Date>(today);
  const [to, setTo] = useState<Date>(
    () => new Date(today.getTime() + 13 * 86_400_000),
  );

  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
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
  }, [from, to]);

  function toggleMember(id: string) {
    setHiddenMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Group events by day key. Filtered by member chips. */
  const grouped = useMemo(() => {
    const map = new Map<string, TeamEvent[]>();
    for (const e of events) {
      if (hiddenMemberIds.has(e.userId)) continue;
      const day = isoDay(new Date(e.startAt));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, hiddenMemberIds]);

  const connectedCount = members.filter((m) => m.connected).length;
  const visibleEventCount = events.filter(
    (e) => !hiddenMemberIds.has(e.userId),
  ).length;

  return (
    <div className="space-y-6">
      <Toolbar
        title="Team Calendar"
        subtitle={
          connectedCount === 0
            ? "Nobody has connected a calendar yet — visit Settings → Calendar."
            : `${connectedCount} member${connectedCount === 1 ? "" : "s"} connected · ${visibleEventCount} event${visibleEventCount === 1 ? "" : "s"} in view`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const w = shiftWindow(from, to, -14);
                setFrom(w.from);
                setTo(w.to);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
              title="Previous 2 weeks"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom(today);
                setTo(new Date(today.getTime() + 13 * 86_400_000));
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const w = shiftWindow(from, to, 14);
                setFrom(w.from);
                setTo(w.to);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
              title="Next 2 weeks"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {/* Member chips — click to hide / show that person's events */}
      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
          <span className="mr-2 text-xs font-medium text-muted-foreground">
            Showing:
          </span>
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
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: m.colour }}
                />
                {m.name}
                {!m.connected && (
                  <span className="text-[10px] uppercase tracking-wider">
                    · off
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty / loading / agenda */}
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
              to paste your Google Calendar&apos;s secret iCal URL. Teammates
              can do the same from their own login.
            </p>
          </Empty>
        </Panel>
      ) : grouped.length === 0 ? (
        <Panel padded>
          <Empty>
            <CalendarDays className="mx-auto h-7 w-7 opacity-40" />
            <p className="mt-2 font-semibold">No events in this window.</p>
            <p className="mt-1 text-xs">
              Try expanding the date range, or check the filter chips above.
            </p>
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayEvents]) => {
            const d = new Date(`${day}T00:00:00`);
            const isToday = isoDay(new Date()) === day;
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
                    <EventRow key={`${e.userId}:${e.uid}`} event={e} />
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventRow({ event: e }: { event: TeamEvent }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      {/* Vertical colour stripe = which person */}
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
            {e.allDay
              ? "All day"
              : `${formatTime(e.startAt)} – ${formatTime(e.endAt)}`}
          </span>
          {e.location && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{e.location}</span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              background: `${e.userColour}1f`,
              color: e.userColour,
            }}
          >
            {e.userName}
          </span>
        </div>
        {e.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
            {e.description}
          </p>
        )}
      </div>
      {/* Future: a deep-link to Google Calendar — needs the calendar id
          which isn't in the ICS, so park for now. */}
      <LinkIcon className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/30" />
    </div>
  );
}
