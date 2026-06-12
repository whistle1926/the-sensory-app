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
import {
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Loader2,
  X,
} from "lucide-react";
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

            {/* Expandable, plain-English walkthrough — added because the
                Google steps trip people up (especially on mobile). */}
            <details className="group rounded-xl border border-border bg-muted/30 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <HelpCircle className="h-4 w-4 text-primary" />
                Step-by-step: how to find your calendar link
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>

              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  ⚠️ Do this on a <strong>computer</strong>. The Google
                  Calendar phone app doesn&apos;t show this setting — that&apos;s
                  what trips most people up.
                </p>

                <div>
                  <p className="font-semibold text-foreground">
                    1. Copy the link from Google
                  </p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    <li>
                      On a computer, go to{" "}
                      <strong>calendar.google.com</strong> and sign in.
                    </li>
                    <li>
                      On the left under <em>&ldquo;My calendars&rdquo;</em>,
                      hover over your calendar&apos;s name — three dots
                      (<strong>⋮</strong>) appear. Click them.
                    </li>
                    <li>
                      Click <strong>&ldquo;Settings and sharing&rdquo;</strong>.
                    </li>
                    <li>
                      Scroll down to the{" "}
                      <strong>&ldquo;Integrate calendar&rdquo;</strong> section.
                    </li>
                    <li>
                      Find{" "}
                      <strong>&ldquo;Secret address in iCal format&rdquo;</strong>{" "}
                      and click the copy button. The link ends in{" "}
                      <code className="rounded bg-muted px-1">.ics</code>.
                    </li>
                  </ol>
                </div>

                <div>
                  <p className="font-semibold text-foreground">
                    2. Paste it here
                  </p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    <li>Paste the link into the box above.</li>
                    <li>Pick a colour for your events on the team calendar.</li>
                    <li>
                      Click <strong>&ldquo;Update connection&rdquo;</strong>. Done.
                    </li>
                  </ol>
                </div>

                <p className="text-xs">
                  Your events can take 15 minutes to a few hours to first appear,
                  and Google refreshes every few hours — so it&apos;s not live to
                  the second. On a phone? Open{" "}
                  <strong>calendar.google.com</strong> in your browser (not the
                  app), turn on <em>&ldquo;Desktop site&rdquo;</em>, then follow
                  the steps — but it&apos;s much easier on a computer.
                </p>
              </div>
            </details>
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
