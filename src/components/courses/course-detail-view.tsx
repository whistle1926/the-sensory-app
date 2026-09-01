import Link from "next/link";
import { SubmarineHeader } from "@/components/storefront/submarine-header";
import { BuyPanel } from "@/components/courses/buy-panel";
import { RichTextView } from "@/components/ui/rich-text-view";
import { richTextToPlain } from "@/lib/rich-text";
import {
  Check,
  Clock,
  PlayCircle,
  ArrowLeft,
  Users,
  Quote,
  BadgeCheck,
} from "lucide-react";
import { Chip } from "@/components/ds";

export interface CourseTestimonial {
  quote?: string;
  author?: string;
  role?: string;
  avatarUrl?: string;
}

/** Everything the course page renders. Deliberately a plain shape rather than
 *  a Prisma type, so the editor can pass unsaved form state straight in. */
export interface CourseView {
  id: string;
  title: string;
  slug: string;
  audience: string;
  duration: string;
  description: string;
  price: number;
  priceEur?: number | null;
  level?: string | null;
  tagline?: string | null;
  shortDescription?: string | null;
  heroImageUrl?: string | null;
  thumbnailUrl?: string | null;
  features?: string[];
  isBestseller?: boolean;
  accreditationBadges?: string[];
  instructorName?: string | null;
  instructorRole?: string | null;
  instructorBio?: string | null;
  instructorImageUrl?: string | null;
  audienceFor?: string | null;
  testimonials?: CourseTestimonial[];
  modules: Array<{ id: string; title: string; order: number; videoUrl?: string | null }>;
  resources?: Array<{ title: string }>;
  hasCertificate?: boolean;
  _count?: { enrollments: number };
}

/**
 * The parent-facing course page, as a component.
 *
 * Shared by the real /courses/[slug] route and the live preview pane in the
 * course editor. That sharing is the point: the editor shows the genuine
 * rendering rather than a lookalike, so what an OT signs off is what a parent
 * gets. Any change here lands in both places at once.
 *
 * `previewing` adds the "not published" banner; `interactive` is false in the
 * editor pane so the buy panel can't be clicked while previewing.
 */
export function CourseDetailView({
  course,
  previewing = false,
  showCoursesLink = false,
}: {
  course: CourseView;
  previewing?: boolean;
  /** Only offer "Back to courses" when that listing actually shows this
   *  course. With the Courses section switched off an individually-live
   *  course is reachable by link alone, so the link would send a buyer to a
   *  page that doesn't list what they were just reading. */
  showCoursesLink?: boolean;
}) {
  const testimonials = course.testimonials ?? [];
  const features = course.features ?? [];
  const heroImage = course.heroImageUrl ?? course.thumbnailUrl;
  // A brand-new draft has no enrolments yet — treat missing as zero rather
  // than letting the social-proof line crash the preview.
  const enrolled = course._count?.enrollments ?? 0;

  return (
    <div className="sub min-h-screen">
      {previewing && (
        <div className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-100 px-4 py-2.5 text-center text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <strong>Preview</strong> — this is what parents will see. It is{" "}
          <strong>not published</strong>: nobody else can reach this page yet.
          To put it on sale, set a price, choose status{" "}
          <strong>Available</strong> and turn on{" "}
          <strong>Sell this one now</strong>{" "}in the editor.
        </div>
      )}
      <SubmarineHeader />

      {showCoursesLink && (
        <div className="mx-auto max-w-[1240px] px-5 py-6 sm:px-10">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[#6B7794] hover:text-[#12235B]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to courses
          </Link>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-[1240px] px-5 pb-10 sm:px-10">
        {/* items-start: without it the grid stretches both columns to the
            same height, so the white cover-image box grows taller than the
            16:9 image and shows a white band beneath it when the text column
            is taller. Aligning to the top lets the image box hug the image. */}
        <div className="grid items-start gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#E71D57]">
              <span>{course.audience}</span>
              {course.level && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{course.level}</span>
                </>
              )}
              {course.isBestseller && (
                <Chip tone="warn">Bestseller</Chip>
              )}
            </div>
            <h1 className="sub-display mt-4 text-[38px] leading-[1.05] tracking-[-1.2px] sm:text-[52px]">
              {course.title}
            </h1>
            {course.tagline && (
              <p className="mt-3 text-lg font-bold text-[#E71D57]">
                {course.tagline}
              </p>
            )}
            <p className="mt-4 text-[17px] font-semibold leading-relaxed text-[#3D4A6B] sm:text-lg">
              {course.shortDescription ?? richTextToPlain(course.description ?? "")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-[15px] font-bold text-[#6B7794]">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4" />
                {course.modules.length} module
                {course.modules.length === 1 ? "" : "s"}
              </span>
              {enrolled >= 5 && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {enrolled} enrolled
                </span>
              )}
            </div>
          </div>
          <div className="sub-edge-lg overflow-hidden rounded-[30px] bg-white">
            {heroImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={heroImage}
                alt={course.title}
                /* 16:9 — matches the size the editor asks for and what the
                   image generator produces. It used to be 4:3 here while the
                   field said 16:9, so every wide cover got its sides cut off. */
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-[#FFE9A8]">
                <span className="sub-display text-5xl text-[#12235B]/40">
                  {course.title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main content + sticky buy panel */}
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-20 sm:px-10 md:grid-cols-[1.5fr_1fr]">
        <main className="space-y-12">
          {/* Who this is for — only rendered when populated. Sits above
              "What you'll learn" so visitors immediately know whether
              the course is for them. */}
          {course.audienceFor && course.audienceFor.trim() && (
            <section className="rounded-[26px] border-[3px] border-[#F3DFA6] bg-[#FFF3D2] p-6">
              <h2 className="text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#12235B]">
                Who this is for
              </h2>
              <p className="mt-2 text-base font-semibold leading-relaxed">
                {course.audienceFor}
              </p>
            </section>
          )}

          {/* Features / What you'll learn */}
          {features.length > 0 && (
            <section>
              <h2 className="sub-display text-[28px] tracking-[-.5px]">What you'll learn</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-[22px] border-[3px] border-[#12235B] bg-white p-4"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17B0A7] text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[15px] font-semibold">{f}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {course.description && (
            <section>
              <h2 className="sub-display text-[28px] tracking-[-.5px]">About this course</h2>
              <RichTextView
                html={course.description}
                className="mt-3 text-[15px] leading-relaxed text-muted-foreground"
              />
            </section>
          )}

          {/* Curriculum */}
          {course.modules.length > 0 && (
            <section>
              <h2 className="sub-display text-[28px] tracking-[-.5px]">Curriculum</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {course.modules.length} module
                {course.modules.length === 1 ? "" : "s"} — unlocks in order as
                you complete each one.
              </p>
              <ol className="mt-5 space-y-2">
                {course.modules.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-4 rounded-[22px] border-[3px] border-[#12235B] bg-white px-4 py-3"
                  >
                    <span className="sub-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFC93C] text-sm">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold">{m.title}</p>
                    </div>
                    {m.videoUrl && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <PlayCircle className="h-3.5 w-3.5" />
                        Video
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Instructor */}
          {course.instructorName && (
            <section>
              <h2 className="sub-display text-[28px] tracking-[-.5px]">Your instructor</h2>
              <div className="sub-edge mt-4 flex flex-col gap-4 rounded-[26px] bg-white p-6 sm:flex-row sm:items-start">
                {course.instructorImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={course.instructorImageUrl}
                    alt={course.instructorName}
                    className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                    {course.instructorName.slice(0, 1)}
                  </div>
                )}
                <div>
                  <p className="text-lg font-bold">{course.instructorName}</p>
                  {course.instructorRole && (
                    <p className="mt-0.5 text-sm text-primary">
                      {course.instructorRole}
                    </p>
                  )}
                  {course.instructorBio && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {course.instructorBio}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Testimonials */}
          {testimonials.length > 0 && (
            <section>
              <h2 className="sub-display text-[28px] tracking-[-.5px]">What learners say</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {testimonials.slice(0, 4).map((t, i) => (
                  <blockquote
                    key={i}
                    className="sub-edge rounded-[26px] bg-white p-6"
                  >
                    <Quote className="h-5 w-5 text-[#FFC93C]" />
                    <p className="mt-2 text-sm leading-relaxed">
                      {t.quote ?? ""}
                    </p>
                    {(t.author || t.role) && (
                      <footer className="mt-4 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {t.author ?? "Anonymous"}
                        </span>
                        {t.role && <span> — {t.role}</span>}
                      </footer>
                    )}
                  </blockquote>
                ))}
              </div>
            </section>
          )}

          {/* Accreditation */}
          {course.accreditationBadges && course.accreditationBadges.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <BadgeCheck className="h-5 w-5 text-primary" />
                Accreditation
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {course.accreditationBadges.map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-16 w-auto"
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="md:pl-4">
          <div className="md:sticky md:top-24">
            <BuyPanel
              courseId={course.id}
              courseTitle={course.title}
              courseSlug={course.slug}
              price={course.price}
              priceEur={course.priceEur}
              duration={course.duration}
              moduleCount={course.modules.length}
              resources={(course.resources ?? []).map((r) => r.title)}
              hasCertificate={course.hasCertificate}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
