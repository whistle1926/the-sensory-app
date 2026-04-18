import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StorefrontHeader } from "@/components/courses/storefront-header";
import { BuyPanel } from "@/components/courses/buy-panel";
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

export const dynamic = "force-dynamic";

interface Testimonial {
  quote?: string;
  author?: string;
  role?: string;
  avatarUrl?: string;
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        select: { id: true, title: true, order: true, videoUrl: true },
        orderBy: { order: "asc" },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course || course.status !== "AVAILABLE") notFound();

  const testimonials = Array.isArray(course.testimonials)
    ? (course.testimonials as Testimonial[])
    : [];
  const features = course.features ?? [];
  const heroImage = course.heroImageUrl ?? course.thumbnailUrl;

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <StorefrontHeader />

      <div className="mx-auto max-w-6xl px-5 py-6">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </Link>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
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
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              {course.title}
            </h1>
            {course.tagline && (
              <p className="mt-3 text-lg font-medium text-primary">
                {course.tagline}
              </p>
            )}
            <p className="mt-4 text-lg text-muted-foreground">
              {course.shortDescription ?? course.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4" />
                {course.modules.length} module
                {course.modules.length === 1 ? "" : "s"}
              </span>
              {course._count.enrollments >= 5 && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {course._count.enrollments} enrolled
                </span>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow-md)]">
            {heroImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={heroImage}
                alt={course.title}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
                <span className="text-5xl font-black text-primary/40">
                  {course.title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main content + sticky buy panel */}
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 md:grid-cols-[1.5fr_1fr]">
        <main className="space-y-12">
          {/* Features / What you'll learn */}
          {features.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold tracking-tight">What you'll learn</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white p-4"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm">{f}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {course.description && (
            <section>
              <h2 className="text-2xl font-bold tracking-tight">About this course</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            </section>
          )}

          {/* Curriculum */}
          {course.modules.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold tracking-tight">Curriculum</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {course.modules.length} module
                {course.modules.length === 1 ? "" : "s"} — unlocks in order as
                you complete each one.
              </p>
              <ol className="mt-5 space-y-2">
                {course.modules.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-4 rounded-2xl border border-border/70 bg-white px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
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
              <h2 className="text-2xl font-bold tracking-tight">Your instructor</h2>
              <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border/70 bg-white p-5 sm:flex-row sm:items-start">
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
              <h2 className="text-2xl font-bold tracking-tight">What learners say</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {testimonials.slice(0, 4).map((t, i) => (
                  <blockquote
                    key={i}
                    className="rounded-2xl border border-border/70 bg-white p-5"
                  >
                    <Quote className="h-5 w-5 text-primary/40" />
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
              price={course.price}
              duration={course.duration}
              moduleCount={course.modules.length}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
