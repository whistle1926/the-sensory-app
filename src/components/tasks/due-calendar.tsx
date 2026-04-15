"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** ISO strings or Date objects — the days that have tasks due. */
  dueDates: (string | Date)[];
  /** Highlight "today" in the grid. */
  today?: Date;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function ymdKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function DueCalendar({ dueDates, today = new Date() }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(today));

  const dueSet = useMemo(() => {
    const s = new Set<string>();
    for (const raw of dueDates) {
      const d = typeof raw === "string" ? new Date(raw) : raw;
      if (Number.isNaN(d.getTime())) continue;
      s.add(ymdKey(d));
    }
    return s;
  }, [dueDates]);

  const monthLabel = cursor.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const firstDayWeekday = cursor.getDay(); // 0=Sun
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0
  ).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  // Fill out to complete weeks for a tidy grid.
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = ymdKey(today);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const key = ymdKey(d);
          const isToday = key === todayKey;
          const hasDue = dueSet.has(key);
          return (
            <div
              key={key}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-xs",
                isToday
                  ? "bg-primary/15 font-semibold text-primary"
                  : "text-foreground/80"
              )}
            >
              {d.getDate()}
              {hasDue && (
                <span
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-primary"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Dots = tasks with due dates
      </p>
    </div>
  );
}
