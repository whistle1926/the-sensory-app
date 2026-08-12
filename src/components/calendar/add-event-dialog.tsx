"use client";

/**
 * "Add event" on the team calendar.
 *
 * Writes a plain diary entry into a connected Google Calendar — the thing
 * bookings can't do. Kept deliberately short: title, who, when, how long.
 * Anything richer (repeats, guests, reminders) is what Google itself is for,
 * and the event opens there once it's made.
 */
import { useEffect, useState } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";

export interface EventTarget {
  id: string;
  name: string;
  connected: boolean;
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];

export function AddEventDialog({
  open,
  onClose,
  onAdded,
  members,
  currentUserId,
  canPickPerson,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  members: EventTarget[];
  currentUserId: string;
  canPickPerson: boolean;
  /** "YYYY-MM-DD" — prefilled when opened from a day cell. */
  defaultDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [userId, setUserId] = useState(currentUserId);
  const [date, setDate] = useState(defaultDate ?? "");
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setUserId(currentUserId);
    setDate(defaultDate ?? new Date().toISOString().slice(0, 10));
    setTime("09:00");
    setDuration(60);
    setLocation("");
    setNotes("");
    setError(null);
  }, [open, defaultDate, currentUserId]);

  if (!open) return null;

  // Only people with a calendar to write to are worth offering.
  const options = members.filter((m) => m.connected);
  const noOneConnected = options.length === 0;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/team-calendar/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, userId, date, time, durationMinutes, location, notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Couldn't add that. Try again.");
        return;
      }
      onAdded();
      onClose();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="my-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Add an event
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Goes straight into the Google Calendar, so it shows on the phone
              too. For a client appointment use Bookings → New booking instead.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {noOneConnected ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            Nobody has connected a Google Calendar yet, so there&apos;s nowhere
            to put an event. Connect one in Settings → Calendar first.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">What is it?</label>
              <input
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. School visit — St Mary's, or Admin morning"
                autoFocus
              />
            </div>

            {canPickPerson && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Whose calendar</label>
                <select
                  className={field}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.id === currentUserId ? " (you)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Date</label>
                <input
                  type="date"
                  className={field}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Start</label>
                <input
                  type="time"
                  className={field}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">How long</label>
                <select
                  className={field}
                  value={durationMinutes}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d < 60 ? `${d} mins` : d % 60 === 0 ? `${d / 60} hour${d === 60 ? "" : "s"}` : `${Math.floor(d / 60)}h ${d % 60}m`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Where (optional)</label>
              <input
                className={field}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Coalisland clinic"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notes (optional)</label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || noOneConnected || !title.trim() || !date || !time}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add to calendar
          </button>
        </div>
      </div>
    </div>
  );
}
