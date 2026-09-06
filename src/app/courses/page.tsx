import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { richTextToPlain } from "@/lib/rich-text";
import { SubmarineHeader } from "@/components/storefront/submarine-header";
import { SubmarineFooter } from "@/components/storefront/submarine-footer";
import { TrustPills } from "@/components/storefront/trust-pills";
import {
  SubmarineCourseCard,
  type SubCourse,
} from "@/components/storefront/submarine-course-card";
import { Star, ShieldCheck, Award, Sparkles } from "lucide-react";
import { coursesEnabled } from "@/lib/storefront";

// Fetch fresh on every request — new courses should show up immediately
// after the seed script runs, without waiting for a cache bust.
export const dynamic = "force-dynamic";

const DEFAULT_TAGLINE = "Where expert knowledge meets playful, child-centred practice";
const DEFAULT_HERO_TITLE =
  "Evidence-based courses, specialist occupational therapy services, and support for parents and professionals";
const DEFAULT_HERO_BLURB =
  "Supporting children to thrive through expert-led courses, specialist assessments, and personalised occupational therapy. Designed for parents, educators, and professionals seeking practical, child-centred strategies that make a real difference.";

export default async function CoursesStorefrontPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Visitor-typed search via ?q=… in the URL. Server-rendered so the
  // filtered URL is bookmarkable + indexable by search engines + shows
  // up cleanly in ad-platform attribution.
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  // Admin-editable hero copy via Settings → Storefront. Null fields
  // fall back to the defaults above so the page always has something
  // sensible to render.
  const config = await prisma.storefrontConfig.findUnique({
    where: { id: "default" },
  });
  // Courses paused → don't show the storefront at all (content isn't
  // ready). Send visitors to the home page.
  if (config && config.showCoursesNav === false) {
    redirect("/");
  }
  const tagline = config?.tagline?.trim() || DEFAULT_TAGLINE;
  const heroTitle = config?.heroTitle?.trim() || DEFAULT_HERO_TITLE;
  const heroBlurb = config?.heroBlurb?.trim() || DEFAULT_HERO_BLURB;

  // When the Courses section is paused, only individually-published courses
  // (the finished parent webinars) are listed — the rest stay hidden.
  const sectionOn = await coursesEnabled();
  const courses = await prisma.course.findMany({
    where: sectionOn
      ? { status: "AVAILABLE" }
      : { status: "AVAILABLE", isLive: true },
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

  // Apply visitor's search filter before featured/rest split. Matches on
  // title, tagline, description and audience so common synonyms still
  // surface the right course (e.g. "kids", "parents", "fine motor").
  const matches = (c: (typeof courses)[number]) => {
    if (!query) return true;
    const hay = [
      c.title,
      c.tagline ?? "",
      c.shortDescription ?? "",
      richTextToPlain(c.description ?? ""),
      c.audience ?? "",
      c.level ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  };
  const filtered = courses.filter(matches);
  const featured = filtered.filter((c) => c.isFeatured);
  const rest = filtered.filter((c) => !c.isFeatured);

  // Collect unique accreditation badges to render a trust strip.
  const allBadges = Array.from(
    new Set(courses.flatMap((c) => c.accreditationBadges ?? [])),
  );

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 py-14 sm:px-10 sm:py-[72px]">
        <div className="sub-dots pointer-events-none absolute inset-0 opacity-90" aria-hidden />
        <div
          className="pointer-events-none absolute -right-[120px] -top-[140px] h-[520px] w-[520px] rounded-full bg-[#FFE9A8]"
          aria-hidden
        />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="sub-edge inline-flex items-center gap-2.5 rounded-full bg-white py-2 pl-2.5 pr-4 text-[13px] font-extrabold uppercase tracking-[1.4px]">
              <span className="h-[22px] w-[22px] rounded-full bg-[#17B0A7]" aria-hidden />
              {tagline}
            </p>
            {/* Smaller than the home hero on purpose: this headline is
                editable copy and is usually a full sentence, not three
                words. */}
            <h1 className="sub-display mt-6 text-[32px] leading-[1.08] tracking-[-1px] text-pretty sm:text-[42px] lg:text-[48px]">
              {heroTitle}
            </h1>
            <p className="mt-5 max-w-[560px] text-[17px] leading-[1.65] text-pretty text-[#3D4A6B] sm:text-[19px]">
              {heroBlurb}
            </p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                href="#courses"
                className="sub-edge-lg sub-press inline-flex items-center rounded-full px-7 py-4 text-[17px] font-extrabold text-white"
                style={{ background: "var(--sub-pink)" }}
              >
                Browse courses
              </Link>
              <Link
                href="/book"
                className="sub-edge-lg sub-press inline-flex items-center rounded-full bg-white px-7 py-4 text-[17px] font-extrabold"
              >
                Book a 1:1 session
              </Link>
            </div>
            <TrustPills className="mt-9" />
          </div>

          {/* Tilted covers, hidden on small screens where they'd push the
              buttons off the first screenful. */}
          <div className="relative hidden min-h-[520px] lg:block" aria-hidden>
            <div
              className="absolute left-10 top-6 h-[280px] w-[280px] rounded-full bg-[#FFC93C]"
              aria-hidden
            />
            {featured.slice(0, 3).map((c, i) => {
              const img = c.thumbnailUrl ?? c.heroImageUrl;
              const place = [
                { className: "right-8 top-0", tilt: "rotate(6deg)", delay: "0s" },
                { className: "left-0 top-[190px]", tilt: "rotate(-7deg)", delay: ".6s" },
                { className: "right-16 top-[330px]", tilt: "rotate(3deg)", delay: "1.2s" },
              ][i];
              return (
                <div
                  key={c.id}
                  className={`sub-bob absolute aspect-[4/3] w-[270px] overflow-hidden rounded-[26px] border-[3px] border-[#12235B] bg-[#FFE9A8] shadow-[6px_6px_0_#12235B] ${place.className}`}
                  style={{
                    ["--sub-tilt" as string]: place.tilt,
                    transform: place.tilt,
                    animationDelay: place.delay,
                  }}
                >
                  {img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="sub-display flex h-full items-center justify-center text-3xl">
                      {c.title.slice(0, 2)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured row */}
      {featured.length > 0 && (
        <section className="px-5 pb-4 sm:px-10">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-6 flex items-center gap-3.5">
              <span className="sub-display text-2xl sm:text-[28px]">
                Our most popular courses
              </span>
              <span className="h-[3px] flex-1 bg-[#EADCC4]" aria-hidden />
            </div>
            <div className="grid items-start gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((course) => (
                <SubmarineCourseCard key={course.id} course={course as SubCourse} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All courses */}
      <section
        id="courses"
        className="scroll-mt-24 px-5 py-14 sm:px-10"
      >
        <div className="mx-auto max-w-[1240px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#E71D57]">
              The library
            </p>
            <h2 className="sub-display mt-1.5 text-[30px] tracking-[-.8px] sm:text-[40px]">
              Explore all courses
            </h2>
          </div>
          {/* Search — URL-driven so it survives reload, shares, and ad
              landing pages with prefilled queries (`/courses?q=fine+motor`). */}
          <form
            method="GET"
            className="flex w-full max-w-sm items-center gap-2 sm:w-auto"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                🔍
              </span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search courses…"
                className="w-full rounded-full border-[3px] border-[#D9D2C4] bg-white py-2.5 pl-10 pr-4 text-[15px] font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B]"
              />
            </div>
            {query && (
              <Link
                href="/courses"
                className="text-sm font-bold text-[#E71D57] hover:text-[#B81243]"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-[30px] border-[3px] border-dashed border-[#D9C9AA] bg-white p-12 text-center">
            <p className="sub-display text-2xl">No courses published yet.</p>
            <p className="mt-2 text-[15px] font-semibold text-[#6B7794]">
              Check back soon — we&apos;re working on it.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[30px] border-[3px] border-dashed border-[#D9C9AA] bg-white p-12 text-center">
            <p className="sub-display text-2xl">
              No courses match &ldquo;{query}&rdquo;.
            </p>
            <p className="mt-2 text-[15px] font-semibold text-[#6B7794]">
              Try a different search, or{" "}
              <Link href="/courses" className="font-bold text-[#E71D57]">
                clear the filter
              </Link>{" "}
              to see everything.
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {(rest.length > 0 ? rest : filtered).map((course) => (
              <SubmarineCourseCard key={course.id} course={course as SubCourse} />
            ))}
          </div>
        )}
        </div>
      </section>

      {allBadges.length > 0 && (
        <section className="px-5 py-14 sm:px-10">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-center text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#6B7794]">
              Trusted, accredited, evidence-based
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
              {allBadges.slice(0, 8).map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={url} alt="" className="h-12 w-auto" />
              ))}
            </div>
          </div>
        </section>
      )}

      <SubmarineFooter />
    </div>
  );
}
