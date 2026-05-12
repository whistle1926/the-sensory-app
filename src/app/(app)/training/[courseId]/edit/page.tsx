"use client";

/**
 * Staff-only course content editor. Lets Patrick / Grace update the
 * fields that Grace specifically asked about in the May 2026 client
 * feedback batch:
 *
 *  • Instructor name / role / bio (overrides per-course)
 *  • "Who this is for" callout text (`audienceFor`)
 *  • Testimonials — list editor (add / edit / delete)
 *  • Next-course recommendation for the post-completion screen
 *  • Module video URLs (Loom / YouTube / Vimeo share links)
 *
 * Anything not exposed here (title, slug, price, status, hero image,
 * features list, etc.) still lives in the seed scripts — intentional
 * trade-off to keep the first editor focused and safe.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Testimonial {
  quote: string;
  author: string;
  role?: string;
  avatarUrl?: string;
}

interface ModuleRow {
  id: string;
  title: string;
  order: number;
}

interface CourseShape {
  id: string;
  title: string;
  audience: string;
  instructorName: string | null;
  instructorRole: string | null;
  instructorBio: string | null;
  instructorImageUrl: string | null;
  audienceFor: string | null;
  nextCourseId: string | null;
  testimonials: Testimonial[];
  modules: ModuleRow[];
}

interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

export default function CourseEditPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const [course, setCourse] = useState<CourseShape | null>(null);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);
  const [moduleVideos, setModuleVideos] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data: CourseShape & { testimonials?: unknown }) => {
        const testimonials = Array.isArray(data.testimonials)
          ? (data.testimonials as Testimonial[])
          : [];
        setCourse({ ...data, testimonials });
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load course"),
      );

    // Pull every other course for the "next course" dropdown. Public
    // endpoint is fine — we only need id/slug/title.
    fetch("/api/courses/public")
      .then((r) => r.json())
      .then((data: CourseOption[]) =>
        setAllCourses(Array.isArray(data) ? data : []),
      )
      .catch(() => {});

    // Pull current video URLs for each module so the inputs render with
    // existing values. Lightweight per-module fetch — fine for the 11
    // or so modules a course typically has.
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then(async (data: CourseShape) => {
        const map: Record<string, string> = {};
        for (const m of data.modules ?? []) {
          try {
            const r = await fetch(`/api/courses/${courseId}/modules/${m.id}`);
            const json = (await r.json()) as { videoUrl?: string | null };
            if (json.videoUrl) map[m.id] = json.videoUrl;
          } catch {
            /* ignore */
          }
        }
        setModuleVideos(map);
      });
  }, [courseId]);

  function patchCourse(p: Partial<CourseShape>) {
    setCourse((c) => (c ? { ...c, ...p } : c));
  }

  async function save() {
    if (!course) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorName: course.instructorName ?? "",
          instructorRole: course.instructorRole ?? "",
          instructorBio: course.instructorBio ?? "",
          instructorImageUrl: course.instructorImageUrl ?? "",
          audienceFor: course.audienceFor ?? "",
          nextCourseId: course.nextCourseId,
          testimonials: course.testimonials,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }

      // Save each module's video URL (only if changed since load).
      await Promise.all(
        course.modules.map(async (m) => {
          await fetch(`/api/courses/${courseId}/modules/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrl: moduleVideos[m.id] ?? "" }),
          });
        }),
      );

      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const otherCourses = allCourses.filter((c) => c.id !== courseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/training/${courseId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to course
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit · {course.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Changes apply immediately on save. Public detail page:{" "}
            <Link
              href={`/courses/${courseId}`}
              target="_blank"
              className="text-primary underline"
            >
              preview
              <ExternalLink className="ml-0.5 inline h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && Date.now() - savedAt < 5000 && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Who this is for ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Who this is for</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Single paragraph rendered as a callout on the public course
          detail page. Leave blank to hide the section.
        </p>
        <textarea
          value={course.audienceFor ?? ""}
          onChange={(e) => patchCourse({ audienceFor: e.target.value })}
          rows={4}
          maxLength={2000}
          placeholder="This course is beneficial for…"
          className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </section>

      {/* ── Instructor ────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Instructor</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on the public course detail page. Override per course
          if a different therapist teaches it.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ins-name">Name</Label>
            <Input
              id="ins-name"
              value={course.instructorName ?? ""}
              onChange={(e) =>
                patchCourse({ instructorName: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ins-role">Role</Label>
            <Input
              id="ins-role"
              value={course.instructorRole ?? ""}
              onChange={(e) =>
                patchCourse({ instructorRole: e.target.value })
              }
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="ins-bio">Bio</Label>
          <textarea
            id="ins-bio"
            value={course.instructorBio ?? ""}
            onChange={(e) => patchCourse({ instructorBio: e.target.value })}
            rows={6}
            maxLength={5000}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="ins-img">Photo URL</Label>
          <Input
            id="ins-img"
            value={course.instructorImageUrl ?? ""}
            placeholder="https://..."
            onChange={(e) =>
              patchCourse({ instructorImageUrl: e.target.value })
            }
          />
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────── */}
      <TestimonialsEditor
        items={course.testimonials}
        onChange={(testimonials) => patchCourse({ testimonials })}
      />

      {/* ── Course progression ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Continue your learning</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          When a learner finishes this course, recommend one of your other
          courses on the completion screen. Optional — leave as &ldquo;none&rdquo;
          to show the generic &ldquo;See all courses&rdquo; link instead.
        </p>
        <select
          value={course.nextCourseId ?? ""}
          onChange={(e) =>
            patchCourse({ nextCourseId: e.target.value || null })
          }
          className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">— No recommendation —</option>
          {otherCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </section>

      {/* ── Module videos ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Module videos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a Loom, YouTube or Vimeo share URL for each module. Leave
          blank if the lesson has no video.
        </p>
        <div className="mt-4 space-y-3">
          {course.modules.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3"
            >
              <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-48 shrink-0 text-sm font-medium">
                {m.order + 1}. {m.title}
              </span>
              <Input
                value={moduleVideos[m.id] ?? ""}
                onChange={(e) =>
                  setModuleVideos((prev) => ({
                    ...prev,
                    [m.id]: e.target.value,
                  }))
                }
                placeholder="https://www.loom.com/share/..."
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Testimonials list editor — add, edit, delete. Stored on the Course
 * row as a JSON column; each save round-trips the whole array. */
function TestimonialsEditor({
  items,
  onChange,
}: {
  items: Testimonial[];
  onChange: (next: Testimonial[]) => void;
}) {
  function patch(i: number, p: Partial<Testimonial>) {
    onChange(items.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  }
  function add() {
    onChange([...items, { quote: "", author: "" }]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Testimonials</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quotes from past learners. Rendered as &ldquo;What learners say&rdquo;
            on the public course detail page. Quote + author are required;
            role is optional.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={add}
          className="rounded-xl"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add testimonial
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-xs italic text-muted-foreground">
          No testimonials yet. Click &ldquo;Add testimonial&rdquo; to seed one.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((t, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Testimonial {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={t.quote}
                onChange={(e) => patch(i, { quote: e.target.value })}
                rows={3}
                placeholder="Quote — what did they say about the course?"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={t.author}
                  onChange={(e) => patch(i, { author: e.target.value })}
                  placeholder="Author name (required)"
                />
                <Input
                  value={t.role ?? ""}
                  onChange={(e) => patch(i, { role: e.target.value })}
                  placeholder="Role / business (optional)"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
