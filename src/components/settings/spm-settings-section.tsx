"use client";

/**
 * Settings → Assessments — the standard SPM (Sensory Processing
 * Measure) link. Stored in PracticeSettings and used to pre-fill the
 * "Add assessment" dialog on every client record, so the OT doesn't
 * retype the WPS Hub URL each time.
 *
 * URL only — login credentials are never stored here; keep those in a
 * password manager.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SpmSettingsSection() {
  const [spmLinkUrl, setSpmLinkUrl] = useState("");
  const [original, setOriginal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/practice")
      .then((r) => r.json())
      .then((data: { spmLinkUrl?: string }) => {
        setSpmLinkUrl(data.spmLinkUrl ?? "");
        setOriginal(data.spmLinkUrl ?? "");
      })
      .catch(() => setError("Couldn't load the assessment settings."));
  }, []);

  const dirty = original !== null && spmLinkUrl.trim() !== original.trim();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/practice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spmLinkUrl: spmLinkUrl.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      const updated = (await res.json()) as { spmLinkUrl: string };
      setSpmLinkUrl(updated.spmLinkUrl);
      setOriginal(updated.spmLinkUrl);
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
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Standard SPM link</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The online Sensory Processing Measure link you use for most
              clients. It pre-fills the “Add assessment” dialog on a client’s
              record so you can share it in one click.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="spm-link-url">SPM / WPS Hub link</Label>
          <Input
            id="spm-link-url"
            value={spmLinkUrl}
            onChange={(e) => setSpmLinkUrl(e.target.value)}
            placeholder="https://hub.wpspublish.com/landing"
          />
          {spmLinkUrl.trim() && /^https?:\/\//i.test(spmLinkUrl.trim()) && (
            <a
              href={spmLinkUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open link
            </a>
          )}
          <p className="text-[11px] text-muted-foreground">
            Link only — never store your WPS login or password here. Keep those
            in a password manager.
          </p>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
          {savedAt && Date.now() - savedAt < 5000 && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button onClick={save} disabled={!dirty || saving} className="rounded-xl">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save link
          </Button>
        </div>
      </div>
    </div>
  );
}
