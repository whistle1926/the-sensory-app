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
  Eye,
  ExternalLink,
  Loader2,
  MessageSquareQuote,
  PaintBucket,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Testimonial {
  quote: string;
  author: string;
  meta?: string;
}

interface State {
  tagline: string;
  heroTitle: string;
  heroBlurb: string;
  showHomeNav: boolean;
  showCoursesNav: boolean;
  showSignIn: boolean;
  showCreateAccount: boolean;
  testimonials: Testimonial[];
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
    showHomeNav: true,
    showCoursesNav: true,
    showSignIn: true,
    showCreateAccount: true,
    testimonials: [],
  });
  const [original, setOriginal] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/storefront")
      .then((r) => r.json())
      .then((data: Partial<State>) => {
        // Fill any missing fields with safe defaults so a stale row
        // doesn't leave a checkbox in undefined-land.
        const next: State = {
          tagline: data.tagline ?? "",
          heroTitle: data.heroTitle ?? "",
          heroBlurb: data.heroBlurb ?? "",
          showHomeNav: data.showHomeNav ?? true,
          showCoursesNav: data.showCoursesNav ?? true,
          showSignIn: data.showSignIn ?? true,
          showCreateAccount: data.showCreateAccount ?? true,
          testimonials: Array.isArray(data.testimonials) ? data.testimonials : [],
        };
        setState(next);
        setOriginal(next);
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
      {/* Public-header visibility toggles. Keeps the hero edit form
          underneath unchanged — these are a separate concern (what's
          *shown* vs what *copy* is shown). */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Public navigation</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Hide individual nav items on the public site without changing the
              underlying pages. Useful when you want to pause sign-ups or hide
              courses while you tidy content — flip back on when ready.
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {[
            {
              key: "showHomeNav" as const,
              label: "Home link",
              hint: "Header link to the marketing landing. Hide to leave just Book a session in the public nav.",
            },
            {
              key: "showCoursesNav" as const,
              label: "Courses (link + hero section)",
              hint: "Hides the Courses nav link AND every courses-related CTA + the featured-courses shelf on the landing page. The /courses page itself stays reachable directly.",
            },
            {
              key: "showSignIn" as const,
              label: "Sign in button",
              hint: "Hides the Sign in chip on the public header + footer. /login stays reachable.",
            },
            {
              key: "showCreateAccount" as const,
              label: "Create account button",
              hint: "Pauses new self-serve sign-ups in the public UI. /register stays reachable directly.",
            },
          ].map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/40 p-3"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.hint}
                </p>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={state[row.key]}
                  onChange={(e) =>
                    setState((s) => ({ ...s, [row.key]: e.target.checked }))
                  }
                />
                <span className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40" />
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
                <span className="sr-only">
                  {state[row.key] ? "Visible" : "Hidden"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

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

      {/* Parent testimonials for the public booking page. */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquareQuote className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Booking page testimonials</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The “What families say” reviews shown on the public{" "}
              <a
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline"
              >
                booking page <ExternalLink className="h-3 w-3" />
              </a>
              . Paste real reviews (e.g. from Google) — a shortened excerpt is
              fine.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {state.testimonials.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No testimonials yet — add one below.
            </p>
          )}

          {state.testimonials.map((t, i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3"
            >
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Review {i + 1}
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      testimonials: s.testimonials.filter((_, idx) => idx !== i),
                    }))
                  }
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  aria-label="Remove review"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                value={t.quote}
                placeholder="The review text…"
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    testimonials: s.testimonials.map((x, idx) =>
                      idx === i ? { ...x, quote: e.target.value } : x,
                    ),
                  }))
                }
                rows={3}
                maxLength={600}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-2">
                <Input
                  value={t.author}
                  placeholder="Name (e.g. Sarah Donaghy)"
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      testimonials: s.testimonials.map((x, idx) =>
                        idx === i ? { ...x, author: e.target.value } : x,
                      ),
                    }))
                  }
                  maxLength={120}
                  className="min-w-[160px] flex-1"
                />
                <Input
                  value={t.meta ?? ""}
                  placeholder="Under the name (e.g. Google review)"
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      testimonials: s.testimonials.map((x, idx) =>
                        idx === i ? { ...x, meta: e.target.value } : x,
                      ),
                    }))
                  }
                  maxLength={120}
                  className="min-w-[160px] flex-1"
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() =>
              setState((s) => ({
                ...s,
                testimonials: [...s.testimonials, { quote: "", author: "", meta: "" }],
              }))
            }
            disabled={state.testimonials.length >= 12}
            className="rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add a testimonial
          </Button>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
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
              Save testimonials
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
