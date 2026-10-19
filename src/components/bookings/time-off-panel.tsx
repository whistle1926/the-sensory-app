"use client";

/**
 * Bookings → Availability → "Time off (all services)".
 *
 * Grace, Sept 2026: availability was per service, so a day off had to be
 * added to every service by hand. Time off here belongs to a PERSON and
 * takes those days out of every service they run — one day or a whole week
 * in one go. Admins can set anyone's (or the practice's, for services with
 * no therapist); associates set their own.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CalendarOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimeOff {
  id: string;
  userId: string | null;
  startDate: string;
  endDate: string;
  note: string;
}

interface Person {
  id: string;
  name: string;
}

const PRACTICE = "__practice__";

function prettyDay(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dayCount(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;
}

export function TimeOffPanel({ isAdmin }: { isAdmin: boolean }) {
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";
  const [rows, setRows] = useState<TimeOff[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form (add or edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [who, setWho] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/availability/time-off");
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!isAdmin) return;
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((users: Array<{ id: string; name: string; role: string; isAutomation?: boolean }>) =>
        setPeople(
          users
            .filter((u) => (u.role === "SUPER_ADMIN" || u.role === "TEAM_MANAGER") && !u.isAutomation)
            .map((u) => ({ id: u.id, name: u.name })),
        ),
      )
      .catch(() => {});
  }, [isAdmin, load]);

  const whoValue = who || myId;
  const nameOf = (userId: string | null) =>
    userId === null
      ? "Practice (unassigned services)"
      : userId === myId
        ? "You"
        : people.find((p) => p.id === userId)?.name ?? "Team member";

  function resetForm() {
    setEditingId(null);
    setWho("");
    setStart("");
    setEnd("");
    setNote("");
    setError(null);
  }

  function edit(r: TimeOff) {
    setEditingId(r.id);
    setWho(r.userId ?? PRACTICE);
    setStart(r.startDate);
    setEnd(r.endDate);
    setNote(r.note);
    setError(null);
  }

  async function save() {
    if (!start) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        userId: whoValue === PRACTICE ? null : whoValue,
        startDate: start,
        endDate: end || start,
        note,
      };
      const res = await fetch(
        editingId ? `/api/availability/time-off?id=${editingId}` : "/api/availability/time-off",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/availability/time-off?id=${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const input =
    "flex h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div
      data-help="bookings-time-off"
      className="rounded-2xl border-2 border-primary/25 bg-card p-6 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <CalendarOff className="h-4.5 w-4.5 text-primary" />
        </span>
        <div>
          <h3 className="text-base font-semibold">Time off — all services</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Off for a day or a week? Add it once here and it&apos;s taken out of
            every service {isAdmin ? "that person runs" : "you run"} — no need to
            change each service&apos;s calendar.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
                editingId === r.id ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/50"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {r.startDate === r.endDate
                    ? prettyDay(r.startDate)
                    : `${prettyDay(r.startDate)} – ${prettyDay(r.endDate)}`}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {dayCount(r.startDate, r.endDate)} day
                    {dayCount(r.startDate, r.endDate) === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {isAdmin ? nameOf(r.userId) : "You"}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => edit(r)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Edit"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(r.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                  aria-label="Remove"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No time off booked.</p>
      )}

      <div className="mt-4 rounded-xl border border-dashed border-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          {isAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Who</label>
              <select value={whoValue} onChange={(e) => setWho(e.target.value)} className={input}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === myId ? `${p.name} (you)` : p.name}
                  </option>
                ))}
                <option value={PRACTICE}>Practice (unassigned services)</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To (optional)</label>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className={input}
            />
          </div>
          <div className="min-w-[160px] flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
            <input
              type="text"
              value={note}
              placeholder="e.g. Annual leave"
              onChange={(e) => setNote(e.target.value)}
              className={`${input} w-full`}
            />
          </div>
          <Button onClick={save} disabled={!start || busy} className="rounded-xl">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? null : <Plus className="mr-2 h-4 w-4" />}
            {editingId ? "Save changes" : "Add time off"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm} className="rounded-xl">
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
}
