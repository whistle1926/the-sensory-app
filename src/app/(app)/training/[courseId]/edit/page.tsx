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
  Check,
  CheckCircle2,
  Copy,
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CopyAssist } from "@/components/training/copy-assist";
import { CourseImageField } from "@/components/training/course-image-field";
import { InstructorPhotoField } from "@/components/training/instructor-photo-field";
import { LivePreviewPane } from "@/components/training/live-preview-pane";
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
  priceEur: number | null;
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
  upsellCourseIds: string[];
  upsellHeadline: string | null;
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [instructorNote, setInstructorNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** (Re)load the course from the server. */
  function load() {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data: CourseShape & { testimonials?: unknown }) => {
        const testimonials = Array.isArray(data.testimonials)
          ? (data.testimonials as Testimonial[])
          : [];
        setCourse({ ...data, testimonials } as unknown as CourseShape);
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
      // Say plainly when a field was empty — otherwise only the name appears
      // and it looks like the button half-worked.
      const missing = [
        !me.bio ? "bio" : null,
        !me.photoUrl ? "photo" : null,
      ].filter(Boolean);
      setInstructorNote(
        missing.length
          ? `Your name came across. You haven't saved a ${missing.join(" or ")} yet — write it below and press "Save these as my details" so it carries across next time.`
          : "Your name, bio and photo have been filled in.",
      );
    } catch {
      /* leave the fields as they are */
    }
  }

  /** Push what's on this course into your own profile, so the next course
   *  starts from it. This is what makes the bio reusable. */
  async function saveInstructorToProfile() {
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: course?.instructorBio ?? "",
          photoUrl: course?.instructorImageUrl ?? "",
        }),
      });
      setInstructorNote(
        res.ok
          ? "Saved. Every new course can now pull this in with \"Use my details\"."
          : "Couldn't save that just now.",
      );
    } catch {
      setInstructorNote("Couldn't save that just now.");
    }
  }

  const publicUrl = `${origin}/courses/${course?.slug ?? ""}`;

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
          priceEur: course.priceEur,
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
          upsellCourseIds: course.upsellCourseIds,
          upsellHeadline: course.upsellHeadline,
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

          {/* The address to actually send people. While the Courses section
              is switched off this link is the ONLY way in — the course won't
              be listed anywhere — so it needs to be easy to grab. */}
          <div className="mt-3 max-w-xl rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {course.isLive && course.status === "AVAILABLE"
                ? "Live link — send this to parents"
                : "Link once it's on sale"}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-2 py-1.5 text-xs">
                {publicUrl}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  } catch {
                    /* clipboard blocked — the text is on screen to copy by hand */
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            {!(course.isLive && course.status === "AVAILABLE") && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Not reachable yet — needs status &ldquo;Available&rdquo; and
                &ldquo;Sell this one now&rdquo; switched on, then Save.
              </p>
            )}
          </div>
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
            {/* The long description is the main sales copy on the public
                course page, so it gets a proper editor — headings, bold and
                bullets, rather than one grey wall of text. */}
            <Label htmlFor="c-desc">Description</Label>
            <RichTextEditor
              value={course.description}
              onChange={(html) => patchCourse({ description: html })}
              placeholder="What the course covers, who it's for, and what they'll walk away with."
              minHeight={200}
            />
            <p className="text-xs text-muted-foreground">
              This is the &ldquo;About this course&rdquo; section parents read
              before they buy. Bullets and short paragraphs read better than
              one long block.
            </p>
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
            <Label htmlFor="c-price-eur">Price (€) — optional</Label>
            <Input
              id="c-price-eur"
              type="number"
              min={0}
              placeholder="Leave blank for £ only"
              value={course.priceEur ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patchCourse({ priceEur: raw === "" ? null : Number(raw) || 0 });
              }}
            />
            <p className="text-xs text-muted-foreground">
              {course.priceEur == null
                ? "Sterling only. Fire can't take a euro payment against a £ price, so buyers with a euro account can't pay."
                : `Buyers can choose € — €${course.priceEur} lands in the Euro account. Set by hand, not converted.`}
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
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={fillInstructorFromProfile}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
              title="Fills these fields from your saved details"
            >
              Use my details
            </button>
            <button
              type="button"
              onClick={saveInstructorToProfile}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
              title="Remembers what's below, so other courses can reuse it"
            >
              Save these as my details
            </button>
          </div>
        </div>
        {instructorNote && (
          <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
            {instructorNote}
          </p>
        )}
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

      {/* ── Checkout add-ons ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold">Offer alongside at checkout</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tick the courses to offer as add-ons on this course&apos;s checkout
          page. The buyer can add them with one tick and pay for everything in
          one go. Leave all unticked for a plain checkout.
        </p>
        <div className="mt-4 space-y-2">
          {otherCourses.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No other courses to offer yet.
            </p>
          )}
          {otherCourses.map((c) => {
            const on = (course.upsellCourseIds ?? []).includes(c.id);
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    const set = new Set(course.upsellCourseIds ?? []);
                    if (e.target.checked) set.add(c.id);
                    else set.delete(c.id);
                    patchCourse({ upsellCourseIds: [...set] });
                  }}
                />
                <span className="font-medium">{c.title}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Anything not on sale, or with no modules yet, is skipped
          automatically — so a half-finished course can&apos;t appear.
        </p>

        <div className="mt-5 border-t border-border pt-5">
          <Label htmlFor="c-upsell-headline">
            How THIS course is pitched on someone else&apos;s checkout
          </Label>
          <Input
            id="c-upsell-headline"
            value={course.upsellHeadline ?? ""}
            maxLength={160}
            placeholder="e.g. Getting bedtime back on track"
            onChange={(e) => patchCourse({ upsellHeadline: e.target.value })}
            className="mt-2"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            One benefit-led line. The person reading it came for a different
            course, so lead with what changes for them and their child, not the
            course title — that&apos;s shown underneath anyway. Blank falls back
            to the tagline.
          </p>
        </div>
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
