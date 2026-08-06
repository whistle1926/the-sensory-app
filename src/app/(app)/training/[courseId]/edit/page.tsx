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
 * Since extended to cover pricing, status, storefront copy and imagery, an
 * AI copy assistant that drafts the course page from a few plain lines, and
 * downloadable handouts. Slug is still fixed after creation — changing it
 * would break any link already shared.
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
import { CopyAssist } from "@/components/training/copy-assist";
import { CourseImageField } from "@/components/training/course-image-field";
import { InstructorPhotoField } from "@/components/training/instructor-photo-field";
import { LivePreviewPane } from "@/components/training/live-preview-pane";
import { PublishBar } from "@/components/training/publish-bar";
import { DRAFT_FIELDS, withDraft } from "@/lib/course-draft";
import { CourseResources } from "@/components/training/course-resources";

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

type CourseStatus = "AVAILABLE" | "COMING_SOON" | "ARCHIVED";

interface CourseShape {
  id: string;
  title: string;
  slug: string;
  audience: string;
  duration: string;
  description: string;
  status: CourseStatus;
  level: string | null;
  price: number;
  isFeatured: boolean;
  isBestseller: boolean;
  isLive: boolean;
  hasCertificate: boolean;
  resources?: Array<{ title: string }>;
  copyNotes: string | null;
  tagline: string | null;
  shortDescription: string | null;
  heroImageUrl: string | null;
  thumbnailUrl: string | null;
  features: string[];
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

  /** (Re)load the course, opening on the unpublished draft when there is one.
   *  Called on mount and again after publishing or discarding. */
  function load() {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data: CourseShape & { testimonials?: unknown }) => {
        const testimonials = Array.isArray(data.testimonials)
          ? (data.testimonials as Testimonial[])
          : [];
        // Open on the unpublished draft if there is one, so you carry on from
        // where you left off rather than from what's live.
        const merged = withDraft(
          { ...data, testimonials } as unknown as Record<string, unknown>,
          (data as unknown as { draft?: unknown }).draft,
        ) as unknown as CourseShape;
        setCourse(merged);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load course"),
      );
  }

  useEffect(() => {
    load();

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

  /** Pull the instructor block from the signed-in user's own Team profile, so
   *  a bio written once can be reused across every course. */
  async function fillInstructorFromProfile() {
    try {
      const res = await fetch("/api/users/me");
      if (!res.ok) return;
      const me = (await res.json()) as {
        name?: string;
        bio?: string | null;
        photoUrl?: string | null;
      };
      patchCourse({
        instructorName: me.name ?? course?.instructorName ?? "",
        instructorBio: me.bio ?? course?.instructorBio ?? "",
        instructorImageUrl: me.photoUrl ?? course?.instructorImageUrl ?? "",
      });
    } catch {
      /* leave the fields as they are */
    }
  }

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
          // Basic meta
          title: course.title,
          audience: course.audience,
          duration: course.duration,
          description: course.description,
          level: course.level ?? "",
          // Pricing + visibility
          price: course.price,
          status: course.status,
          isFeatured: course.isFeatured,
          isBestseller: course.isBestseller,
          isLive: course.isLive,
          hasCertificate: course.hasCertificate,
          copyNotes: course.copyNotes ?? "",
          // Storefront copy
          tagline: course.tagline ?? "",
          shortDescription: course.shortDescription ?? "",
          heroImageUrl: course.heroImageUrl ?? "",
          thumbnailUrl: course.thumbnailUrl ?? "",
          features: course.features,
          // Instructor + audience + progression
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

      // Save each module's title + video URL in one PATCH per module.
      await Promise.all(
        course.modules.map(async (m) => {
          await fetch(`/api/courses/${courseId}/modules/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: m.title,
              videoUrl: moduleVideos[m.id] ?? "",
            }),
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
            Changes apply immediately on save.
          </p>
          {/* Opens the REAL public page. Staff can see it even before the
              course is on sale, with a "not published" banner across the top —
              so what you check is exactly what a parent gets. The route is
              keyed by slug, not id. */}
          <Link
            href={`/courses/${course.slug}`}
            target="_blank"
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border-2 border-primary/30 bg-primary/[0.04] px-3 py-2 text-xs font-bold transition hover:bg-primary/[0.08]"
          >
            Preview what parents will see
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
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

      {/* ── Basic ─────────────────────────────────────────────────────── */}
      {/* Form on the left, live preview on the right. The preview sticks so it
          stays in view while scrolling a long form, and stacks underneath on
          narrower screens. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)]">
        <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Basic details</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Title, audience and duration shown on the storefront card and the
          course detail page. Slug ({course.slug}) and certificate-template
          identity stay seed-managed.
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-title">Title</Label>
            <Input
              id="c-title"
              value={course.title}
              onChange={(e) => patchCourse({ title: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="c-audience">Audience</Label>
              <Input
                id="c-audience"
                value={course.audience}
                placeholder="Parents & carers"
                onChange={(e) => patchCourse({ audience: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-duration">Duration</Label>
              <Input
                id="c-duration"
                value={course.duration}
                placeholder="2 hours (self-paced)"
                onChange={(e) => patchCourse({ duration: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-level">Level</Label>
              <Input
                id="c-level"
                value={course.level ?? ""}
                placeholder="Beginner / Intermediate"
                onChange={(e) => patchCourse({ level: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">Description</Label>
            <textarea
              id="c-desc"
              value={course.description}
              onChange={(e) => patchCourse({ description: e.target.value })}
              rows={4}
              maxLength={5000}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </section>

      {/* ── Pricing & visibility ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Pricing &amp; visibility</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Set a price in pounds (0 = free). Status controls who sees the
          course — &ldquo;Available&rdquo; goes live on /courses; &ldquo;Coming soon&rdquo;
          shows as a teaser with no buy button; &ldquo;Archived&rdquo; hides it.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-price">Price (£)</Label>
            <Input
              id="c-price"
              type="number"
              min={0}
              value={course.price}
              onChange={(e) =>
                patchCourse({ price: Number(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground">
              {course.price === 0
                ? "✓ Free course — no payment required."
                : `Buyers pay £${course.price} via FireBuddy at checkout.`}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-status">Status</Label>
            <select
              id="c-status"
              value={course.status}
              onChange={(e) =>
                patchCourse({ status: e.target.value as CourseStatus })
              }
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="AVAILABLE">Available (live on /courses)</option>
              <option value="COMING_SOON">Coming soon (visible, not buyable)</option>
              <option value="ARCHIVED">Archived (hidden from storefront)</option>
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">Featured</p>
              <p className="text-xs text-muted-foreground">
                Appears in the &ldquo;Featured row&rdquo; on /courses.
              </p>
            </div>
            <Toggle
              checked={course.isFeatured}
              onChange={(v) => patchCourse({ isFeatured: v })}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">Bestseller</p>
              <p className="text-xs text-muted-foreground">
                Shows a &ldquo;Bestseller&rdquo; badge on the card.
              </p>
            </div>
            <Toggle
              checked={course.isBestseller}
              onChange={(v) => patchCourse({ isBestseller: v })}
            />
          </label>
        </div>

        {/* Lets a finished course go on sale while the rest of the catalogue
            stays hidden — the reason the whole section is paused. */}
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-3">
          <div>
            <p className="text-sm font-bold">Sell this one now</p>
            <p className="text-xs text-muted-foreground">
              Put this course on sale even while the Courses section is switched
              off. Use it to launch a finished course without showing the ones
              still being written. Needs status &ldquo;Available&rdquo;.
            </p>
          </div>
          <Toggle
            checked={course.isLive}
            onChange={(v) => patchCourse({ isLive: v })}
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Give a certificate on completion</p>
            <p className="text-xs text-muted-foreground">
              Shown in the buy box and offered when someone finishes. Best left
              off for a short parent webinar — it suits accredited training.
            </p>
          </div>
          <Toggle
            checked={course.hasCertificate}
            onChange={(v) => patchCourse({ hasCertificate: v })}
          />
        </label>

        {course.isLive && course.status !== "AVAILABLE" && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            This is set to sell now, but its status is{" "}
            {course.status === "COMING_SOON" ? "Coming soon" : "Archived"} — so
            nobody can see it. Set the status to Available.
          </p>
        )}
      </section>

      {/* ── AI copy assist ────────────────────────────────────────────── */}
      <CopyAssist
        courseId={courseId}
        notes={course.copyNotes ?? ""}
        onNotesChange={(v) => patchCourse({ copyNotes: v })}
        onApply={(d) =>
          patchCourse({
            tagline: d.tagline || course.tagline,
            shortDescription: d.shortDescription || course.shortDescription,
            description: d.description || course.description,
            audience: d.audience || course.audience,
            audienceFor: d.audienceFor || course.audienceFor,
            features: d.features.length ? d.features : course.features,
          })
        }
      />

      {/* ── Handouts ──────────────────────────────────────────────────── */}
      <CourseResources courseId={courseId} />

      {/* ── Storefront copy ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Storefront copy &amp; imagery</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The tagline / short description / hero image rendered on the
          public course detail page.
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-tag">Tagline</Label>
            <Input
              id="c-tag"
              value={course.tagline ?? ""}
              placeholder="One-line catchphrase under the title."
              onChange={(e) => patchCourse({ tagline: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-short">Short description (storefront card)</Label>
            <textarea
              id="c-short"
              value={course.shortDescription ?? ""}
              onChange={(e) =>
                patchCourse({ shortDescription: e.target.value })
              }
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CourseImageField
              label="Cover image (wide)"
              hint="The big picture at the top of the course page. Upload one, or have one drawn from this course's own words."
              value={course.heroImageUrl ?? ""}
              onChange={(url) => patchCourse({ heroImageUrl: url })}
              courseId={courseId}
              kind="hero"
            />
            <CourseImageField
              label="Card picture"
              hint="The smaller picture on the courses list. Falls back to the cover image if you leave it empty."
              value={course.thumbnailUrl ?? ""}
              onChange={(url) => patchCourse({ thumbnailUrl: url })}
              courseId={courseId}
              kind="thumbnail"
            />
          </div>
          <div className="space-y-2">
            <Label>&ldquo;What you&rsquo;ll learn&rdquo; bullets</Label>
            <FeaturesEditor
              items={course.features}
              onChange={(features) => patchCourse({ features })}
            />
          </div>
        </div>
      </section>

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Instructor</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown on the public course detail page. Change it per course only
              if a different therapist teaches that one.
            </p>
          </div>
          <button
            type="button"
            onClick={fillInstructorFromProfile}
            className="shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
            title="Copies your name, role, bio and photo from your Team profile"
          >
            Use my details
          </button>
        </div>
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
        <div className="mt-4">
          <InstructorPhotoField
            value={course.instructorImageUrl ?? ""}
            onChange={(url) => patchCourse({ instructorImageUrl: url })}
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

      {/* ── Modules ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Modules</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a module per lesson. Title saves with the rest of the form;
              video URL is a Loom / YouTube / Vimeo share link (optional).
              Module body content (text, quiz) lives in a separate lesson
              editor — coming soon.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const res = await fetch(`/api/courses/${courseId}/modules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "New module" }),
              });
              if (res.ok) window.location.reload();
              else alert("Couldn't create module.");
            }}
            className="shrink-0 rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add module
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {course.modules.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              No modules yet — click &ldquo;Add module&rdquo; to create the first one.
            </p>
          ) : (
            course.modules.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3"
              >
                <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={m.title}
                  onChange={(e) => {
                    const next = course.modules.map((mod) =>
                      mod.id === m.id ? { ...mod, title: e.target.value } : mod,
                    );
                    patchCourse({ modules: next });
                  }}
                  placeholder="Module title"
                  className="w-56 shrink-0"
                />
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
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete module "${m.title}"? This can't be undone — module progress for any enrolled learners will also be cleared.`,
                      )
                    ) {
                      return;
                    }
                    const res = await fetch(
                      `/api/courses/${courseId}/modules/${m.id}`,
                      { method: "DELETE" },
                    );
                    if (res.ok) window.location.reload();
                    else alert("Couldn't delete module.");
                  }}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  title="Delete module"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
          <PublishBar
            courseId={courseId}
            draft={Object.fromEntries(
              DRAFT_FIELDS.map((f) => [
                f,
                (course as unknown as Record<string, unknown>)[f],
              ]),
            )}
            onPublished={load}
            onDiscarded={load}
          />
        </div>

        <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-6rem)]">
          <LivePreviewPane
            isLive={course.isLive && course.status === "AVAILABLE"}
            course={{
              id: course.id,
              title: course.title,
              slug: course.slug,
              audience: course.audience,
              duration: course.duration,
              description: course.description,
              price: course.price,
              level: course.level,
              tagline: course.tagline,
              shortDescription: course.shortDescription,
              heroImageUrl: course.heroImageUrl,
              thumbnailUrl: course.thumbnailUrl,
              features: course.features,
              instructorName: course.instructorName,
              instructorRole: course.instructorRole,
              instructorBio: course.instructorBio,
              instructorImageUrl: course.instructorImageUrl,
              audienceFor: course.audienceFor,
              isBestseller: course.isBestseller,
              testimonials: course.testimonials,
              modules: course.modules,
              resources: course.resources ?? [],
              hasCertificate: course.hasCertificate,
            }}
          />
        </aside>
      </div>
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

/** Small switch used in the Pricing & visibility section. */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/** Bulleted "What you'll learn" feature list editor. Add / edit / delete /
 * reorder via up-down buttons. Max 20 features enforced server-side. */
function FeaturesEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  function patch(i: number, v: string) {
    onChange(items.map((x, idx) => (idx === i ? v : x)));
  }
  function add() {
    onChange([...items, ""]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No bullets yet. Click &ldquo;Add bullet&rdquo; to add one.
        </p>
      ) : (
        items.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {i + 1}.
            </span>
            <Input
              value={f}
              onChange={(e) => patch(i, e.target.value)}
              placeholder="What learners will be able to do…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Move down"
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        onClick={add}
        disabled={items.length >= 20}
        className="rounded-xl"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add bullet {items.length >= 20 ? "(max 20)" : ""}
      </Button>
    </div>
  );
}
