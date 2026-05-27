"use client";

/**
 * Settings → Calendar tab.
 *
 * Each staff member pastes their Google Calendar "Secret address in
 * iCal format" here. We store it on their User row and use it to
 * render their events on the team-calendar page. Read-only — see
 * /api/settings/calendar for validation + storage.
 */
import { useEffect, useState } from "react";
import { CalendarDays, Check, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
  "#0ea5e9", // sky
];

export function CalendarSettingsSection() {
  const [icsUrl, setIcsUrl] = useState("");
  const [colour, setColour] = useState<string>("#3b82f6");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings/calendar")
      .then((r) => r.json())
      .then((data: { icsUrl: string | null; colour: string | null }) => {
        setSavedUrl(data.icsUrl);
        setIcsUrl(data.icsUrl ?? "");
        if (data.colour) setColour(data.colour);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: icsUrl.trim() || null, colour }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSavedUrl(icsUrl.trim() || null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setIcsUrl("");
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: null }),
      });
      if (!res.ok) throw new Error("Disconnect failed");
      setSavedUrl(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Google Calendar</h2>
            <p className="text-xs text-muted-foreground">
              Connect your calendar so your meetings show up on the team
              calendar view. Read-only — your events stay where they are.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ics-url">Secret iCal URL</Label>
            <Input
              id="ics-url"
              type="url"
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            />
            <p className="text-xs text-muted-foreground">
              Find this in{" "}
              <a
                href="https://calendar.google.com/calendar/u/0/r/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline"
              >
                Google Calendar Settings <ExternalLink className="h-3 w-3" />
              </a>{" "}
              → click your calendar in the left rail → scroll to{" "}
              <em>&ldquo;Secret address in iCal format&rdquo;</em> → copy.
              Don&apos;t share this URL — anyone with it can see your events.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Event colour on the team view</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColour(c)}
                  aria-label={`Pick colour ${c}`}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    colour === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <X className="mr-1 inline h-3 w-3" />
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
              <Check className="mr-1 inline h-3 w-3" />
              Saved.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={saving || icsUrl === (savedUrl ?? "")}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {savedUrl ? "Update connection" : "Connect calendar"}
            </Button>
            {savedUrl && (
              <Button
                variant="outline"
                onClick={disconnect}
                disabled={saving}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
