"use client";

/**
 * "Change date / time" in the booking popup (Claire, Nov 2026: sometimes a
 * booking just needs moving, not cancelling). Moves the booking, its Google
 * Calendar copy and its reminder emails; optionally emails the client.
 */
import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { londonDateKey } from "@/lib/date-key";

export function RescheduleBox({
  booking,
  onMoved,
}: {
  booking: { id: string; date: string; time: string; clientName: string };
  onMoved: (next: { date: string; time: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => londonDateKey(new Date(booking.date)));
  const [time, setTime] = useState(booking.time);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clash, setClash] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function move(force: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(`${date}T00:00:00`).toISOString(),
          time,
          notify,
          force,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        clash?: string;
        emailed?: boolean;
        booking?: { date: string; time: string };
      };
      if (res.status === 409 && data.clash) {
        setClash(data.clash);
        return;
      }
      if (!res.ok || !data.booking) throw new Error(data.error ?? "Couldn't move the booking.");
      setClash(null);
      setOpen(false);
      setDone(
        notify
          ? data.emailed
            ? `Moved — ${booking.clientName.split(" ")[0]} has been emailed the new time.`
            : "Moved — but the email to the client didn't send, so let them know."
          : "Moved. The client hasn't been emailed.",
      );
      onMoved({ date: data.booking.date, time: data.booking.time });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move the booking.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {done && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{done}</p>}
        <Button
          data-help="booking-change"
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => {
            setOpen(true);
            setDone(null);
          }}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Change date / time
        </Button>
      </div>
    );
  }

  return (
    <div data-help="booking-change" className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-semibold">Move this booking to</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setClash(null);
          }}
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setClash(null);
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Email {booking.clientName.split(" ")[0] || "the client"} the new date and time
      </label>
      {clash && (
        <div className="space-y-2 rounded-lg border border-amber-300/60 bg-amber-50/70 p-2 text-xs dark:border-amber-700/40 dark:bg-amber-950/20">
          <p>{clash}</p>
          <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => move(true)}>
            Move it anyway
          </Button>
        </div>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1 rounded-xl" disabled={busy || !date || !time} onClick={() => move(false)}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Move booking
        </Button>
        <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
          Back
        </Button>
      </div>
    </div>
  );
}
