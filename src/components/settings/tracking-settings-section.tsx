"use client";

/**
 * Settings → Tracking — paste a Microsoft Clarity Project ID and toggle
 * the master enabled flag. Mirrors the safety pattern in
 * tracking-settings/route.ts: the input renders empty when a key is
 * already saved, and an empty submission leaves the saved key alone.
 */
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrackingState {
  enabled: boolean;
  hasClarityId: boolean;
  hasMetaPixelId: boolean;
  clarityProjectId: string;
  metaPixelId: string;
}

export function TrackingSettingsSection() {
  const [state, setState] = useState<TrackingState | null>(null);
  const [draftId, setDraftId] = useState("");
  const [draftPixelId, setDraftPixelId] = useState("");
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/tracking")
      .then((r) => r.json())
      .then((data: TrackingState) => {
        setState(data);
        setDraftEnabled(data.enabled);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load tracking"),
      );
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clarityProjectId: draftId.trim(),
          metaPixelId: draftPixelId.trim(),
          enabled: draftEnabled,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      const data = (await res.json()) as TrackingState;
      setState(data);
      setDraftId("");
      setDraftPixelId("");
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Tracking &amp; analytics</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect Microsoft Clarity for session replays + heatmaps, and
              Meta (Facebook) Pixel for ad conversion tracking. Both scripts
              load automatically across every public page once saved. The
              master toggle below kills everything in one click.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clarity-id">Microsoft Clarity Project ID</Label>
            <Input
              id="clarity-id"
              type="text"
              placeholder={
                state?.hasClarityId
                  ? "Project ID saved — leave blank to keep, or paste a new one to replace"
                  : "e.g. abc123def456"
              }
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {state?.hasClarityId ? (
                <span className="text-green-700 dark:text-green-400">
                  ✓ Clarity ID saved.
                </span>
              ) : (
                "No Clarity ID saved yet."
              )}{" "}
              Find your Project ID at{" "}
              <a
                href="https://clarity.microsoft.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                clarity.microsoft.com
              </a>
              {" → "}Settings{" → "}Setup{" → "}Tracking code (it&apos;s the
              short alphanumeric token at the end of the URL in the snippet).
            </p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="meta-pixel-id">Meta (Facebook) Pixel ID</Label>
            <Input
              id="meta-pixel-id"
              type="text"
              inputMode="numeric"
              placeholder={
                state?.hasMetaPixelId
                  ? "Pixel ID saved — leave blank to keep, or paste a new one to replace"
                  : "e.g. 1234567890123456"
              }
              value={draftPixelId}
              onChange={(e) => setDraftPixelId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {state?.hasMetaPixelId ? (
                <span className="text-green-700 dark:text-green-400">
                  ✓ Meta Pixel ID saved.
                </span>
              ) : (
                "No Meta Pixel ID saved yet."
              )}{" "}
              Find it at{" "}
              <a
                href="https://business.facebook.com/events_manager2/list/pixel"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                business.facebook.com → Events Manager
              </a>
              {" → "}Data sources → your pixel. The ID is a 15-16 digit
              number. Works for both Ads Manager campaigns and Ad Center
              boosts — the pixel fires on every public page once saved.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Enable tracking</p>
              <p className="text-xs text-muted-foreground">
                Master toggle. Off = neither Clarity nor the Meta Pixel
                loads anywhere, no data sent.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draftEnabled}
              onClick={() => setDraftEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                draftEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  draftEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            {savedAt && Date.now() - savedAt < 5000 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            <Button
              onClick={save}
              disabled={saving}
              className="rounded-xl"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save tracking settings
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <h3 className="text-sm font-semibold">UTM attribution</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Already wired and active — no config needed. When ad traffic lands
          with <code className="rounded bg-card px-1 font-mono text-primary">
            ?utm_source=…&amp;utm_campaign=…
          </code>{" "}
          parameters, those values are captured in the visitor&apos;s session
          and saved on the <code className="rounded bg-card px-1 font-mono text-primary">CoursePurchase</code>
          {" "}row when they buy. View the campaign breakdown by querying the{" "}
          <code className="rounded bg-card px-1 font-mono text-primary">utm_campaign</code>{" "}
          column on course orders.
        </p>
      </div>
    </div>
  );
}
