"use client";

/**
 * Settings → Storefront — admin-editable hero copy for /courses.
 *
 * Three fields:
 *  • Tagline   — small text above the title (e.g. "Where expert
 *               knowledge meets playful, child-centred practice")
 *  • Hero title — the big headline
 *  • Hero blurb — supporting paragraph
 *
 * All optional. Empty values fall back to the defaults baked into
 * `/courses/page.tsx`. Save button + a "Preview" link that opens the
 * public storefront in a new tab so the admin can sanity-check.
 */
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  PaintBucket,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface State {
  tagline: string;
  heroTitle: string;
  heroBlurb: string;
}

const DEFAULT_TAGLINE = "Where expert knowledge meets playful, child-centred practice";
const DEFAULT_TITLE =
  "Evidence-based courses, specialist occupational therapy services, and support for parents and professionals";
const DEFAULT_BLURB =
  "Supporting children to thrive through expert-led courses, specialist assessments, and personalised occupational therapy. Designed for parents, educators, and professionals seeking practical, child-centred strategies that make a real difference.";

export function StorefrontSettingsSection() {
  const [state, setState] = useState<State>({
    tagline: "",
    heroTitle: "",
    heroBlurb: "",
  });
  const [original, setOriginal] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/storefront")
      .then((r) => r.json())
      .then((data: State) => {
        setState(data);
        setOriginal(data);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load storefront copy"),
      );
  }, []);

  const dirty = original && JSON.stringify(state) !== JSON.stringify(original);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      const updated = (await res.json()) as State;
      setState(updated);
      setOriginal(updated);
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
            <PaintBucket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Storefront hero</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The copy at the top of the public courses page (
              <a
                href="/courses"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline"
              >
                /courses <ExternalLink className="h-3 w-3" />
              </a>
              ). Leave any field blank to use the default.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storefront-tagline">Tagline</Label>
            <Input
              id="storefront-tagline"
              value={state.tagline}
              placeholder={DEFAULT_TAGLINE}
              onChange={(e) =>
                setState((s) => ({ ...s, tagline: e.target.value }))
              }
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Small text shown above the big headline.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storefront-title">Hero title</Label>
            <Input
              id="storefront-title"
              value={state.heroTitle}
              placeholder={DEFAULT_TITLE}
              onChange={(e) =>
                setState((s) => ({ ...s, heroTitle: e.target.value }))
              }
              maxLength={240}
            />
            <p className="text-xs text-muted-foreground">
              The big headline on the courses page.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storefront-blurb">Supporting blurb</Label>
            <textarea
              id="storefront-blurb"
              value={state.heroBlurb}
              placeholder={DEFAULT_BLURB}
              onChange={(e) =>
                setState((s) => ({ ...s, heroBlurb: e.target.value }))
              }
              rows={4}
              maxLength={1000}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              One short paragraph underneath the title.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <a
              href="/courses"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview /courses
            </a>
            <div className="flex items-center gap-3">
              {savedAt && Date.now() - savedAt < 5000 && !dirty && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
              <Button
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-xl"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save hero copy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
