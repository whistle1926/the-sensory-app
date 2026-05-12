import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StorefrontHeader } from "@/components/courses/storefront-header";
import { CourseCard, type StorefrontCourse } from "@/components/courses/course-card";
import { Star, ShieldCheck, Award, Sparkles } from "lucide-react";

// Fetch fresh on every request — new courses should show up immediately
// after the seed script runs, without waiting for a cache bust.
export const dynamic = "force-dynamic";

const DEFAULT_TAGLINE = "Where expert knowledge meets playful, child-centred practice";
const DEFAULT_HERO_TITLE =
  "Evidence-based courses, specialist occupational therapy services, and support for parents and professionals";
const DEFAULT_HERO_BLURB =
  "Supporting children to thrive through expert-led courses, specialist assessments, and personalised occupational therapy. Designed for parents, educators, and professionals seeking practical, child-centred strategies that make a real difference.";

export default async function CoursesStorefrontPage() {
  // Admin-editable hero copy via Settings → Storefront. Null fields
  // fall back to the defaults above so the page always has something
  // sensible to render.
  const config = await prisma.storefrontConfig.findUnique({
    where: { id: "default" },
  });
  const tagline = config?.tagline?.trim() || DEFAULT_TAGLINE;
  const heroTitle = config?.heroTitle?.trim() || DEFAULT_HERO_TITLE;
  const heroBlurb = config?.heroBlurb?.trim() || DEFAULT_HERO_BLURB;

  const courses = await prisma.course.findMany({
    where: { status: "AVAILABLE" },
    orderBy: [
      { isFeatured: "desc" },
      { order: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      shortDescription: true,
      description: true,
      audience: true,
      duration: true,
      level: true,
      price: true,
      thumbnailUrl: true,
      heroImageUrl: true,
      isFeatured: true,
      isBestseller: true,
      accreditationBadges: true,
      _count: { select: { modules: true, enrollments: true } },
    },
  });

  const featured = courses.filter((c) => c.isFeatured);
  const rest = courses.filter((c) => !c.isFeatured);

  // Collect unique accreditation badges to render a trust strip.
  const allBadges = Array.from(
    new Set(courses.flatMap((c) => c.accreditationBadges ?? [])),
  );

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <StorefrontHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
              <Sparkles className="h-3 w-3" />
              {tagline}
            </span>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              {heroTitle}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              {heroBlurb}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#courses"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:brightness-110"
              >
                Browse courses
              </Link>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Book a 1:1 session
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-5 pt-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                OT-led and evidence-based
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-500" />
                CPD hours for practitioners
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Rated highly by parents
              </span>
            </div>
          </div>

          {/* Hero art — stack of course thumbnails peeking out */}
          <div className="relative h-80 md:h-96">
            {featured.slice(0, 3).map((c, i) => {
              const img = c.thumbnailUrl ?? c.heroImageUrl;
              const offsets = [
                "top-0 right-0 rotate-3",
                "top-14 right-16 -rotate-2 md:top-20 md:right-28",
                "top-32 right-4 rotate-1 md:top-40 md:right-16",
              ];
              return (
                <div
                  key={c.id}
                  className={`absolute aspect-[4/3] w-60 overflow-hidden rounded-2xl border border-border bg-white shadow-[var(--shadow-lg)] md:w-72 ${offsets[i]}`}
                >
                  {img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-primary/10 text-primary">
                      {c.title.slice(0, 2)}
                    </div>
                  )}
                </div>
              );
            })}
            {featured.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/5">
                <p className="text-sm text-muted-foreground">
                  Courses coming soon
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured row */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Featured
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Our most popular courses
              </h2>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((course) => (
              <CourseCard
                key={course.id}
                course={course as StorefrontCourse}
                variant="featured"
              />
            ))}
          </div>
        </section>
      )}

      {/* All courses */}
      <section id="courses" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              The Library
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Explore all courses
            </h2>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {courses.length} course{courses.length === 1 ? "" : "s"} available
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center">
            <p className="font-semibold">No courses published yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon — we're working on it.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(rest.length > 0 ? rest : courses).map((course) => (
              <CourseCard
                key={course.id}
                course={course as StorefrontCourse}
              />
            ))}
          </div>
        )}
      </section>

      {/* Trust strip */}
      {allBadges.length > 0 && (
        <section className="border-t border-border/60 bg-white py-10">
          <div className="mx-auto max-w-6xl px-5">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trusted, accredited, evidence-based
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-6 opacity-60">
              {allBadges.slice(0, 8).map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="h-10 w-auto grayscale transition-all hover:grayscale-0 hover:opacity-100"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border/60 bg-[#FBF8F3] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} The Sensory Submarine</p>
          <div className="flex items-center gap-5">
            <Link href="/book" className="hover:text-foreground">
              Book a session
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
