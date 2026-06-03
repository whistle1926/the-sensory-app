import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  ArrowRight,
  BookOpen,
  Heart,
  MessageCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StorefrontHeader } from "@/components/courses/storefront-header";
import { CourseCard, type StorefrontCourse } from "@/components/courses/course-card";

export const dynamic = "force-dynamic";

/**
 * Public landing page.
 *
 *   - Signed-in staff → /dashboard
 *   - Signed-in CLIENT → /portal (smart redirect sends them to /portal/training
 *                                 if enrolled, otherwise /portal/bookings)
 *   - Visitors → the marketing home, featuring the course catalogue, a
 *                1:1 booking path, and simple proof points.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "CLIENT") redirect("/portal");
    redirect("/dashboard");
  }

  // Pull just enough for the public shelf: featured first, then others.
  const allCourses = await prisma.course.findMany({
    where: { status: "AVAILABLE" },
    orderBy: [
      { isFeatured: "desc" },
      { isBestseller: "desc" },
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

  // Show up to 6 on the home page. Link to /courses for the full library.
  const featured = allCourses.slice(0, 6);
  const totalAvailable = allCourses.length;

  const allBadges = Array.from(
    new Set(allCourses.flatMap((c) => c.accreditationBadges ?? [])),
  ).slice(0, 8);

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <StorefrontHeader />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
              <Sparkles className="h-3 w-3" />
              The Sensory Submarine
            </span>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              Practical support for children with sensory and regulation needs
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Paediatric OT Grace Magennis brings over a decade of hands-on
              experience to families across Northern Ireland. Evidence-based
              1:1 sessions, online courses, and home programmes you can start
              today.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#courses"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:brightness-110"
              >
                <BookOpen className="h-4 w-4" />
                Browse courses
              </Link>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <Video className="h-4 w-4" />
                Book a 1:1 session
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-5 pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                OT-led, evidence-based
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-500" />
                CPD hours for practitioners
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Loved by parents
              </span>
            </div>
          </div>

          {/* Stack of thumbnails peeking out — same treatment as /courses */}
          <div className="relative h-80 md:h-96" aria-hidden>
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
          </div>
        </div>
      </section>

      {/* ── What you can do here ───────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            How we can help
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Three ways to work with us
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Video,
              title: "1:1 sessions",
              body: "Video consultations and in-person visits for assessment, support, and personalised recommendations.",
              cta: "Book a session",
              href: "/book",
            },
            {
              icon: BookOpen,
              title: "Online courses",
              body: "Short, practical courses for parents, teachers and practitioners. Learn at your own pace.",
              cta: "Browse courses",
              href: "#courses",
            },
            {
              icon: Heart,
              title: "Home programmes",
              body: "Structured at-home routines, tailored activities, and troubleshooting built around your child's day.",
              cta: "Talk to us",
              href: "/book",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
                <Link
                  href={card.href}
                  className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  {card.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Featured courses ───────────────────────────────────────── */}
      <section
        id="courses"
        className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
              Online learning
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Courses for parents and practitioners
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Evidence-based mini-courses built around what actually helps at
              home. Start with a free taster or go deep.
            </p>
          </div>
          {totalAvailable > featured.length && (
            <Link
              href="/courses"
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              See all {totalAvailable}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {featured.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-semibold">
              Courses are being prepared
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check back soon — or book a 1:1 session in the meantime.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((course) => (
              <CourseCard
                key={course.id}
                course={course as StorefrontCourse}
                variant={course.isFeatured ? "featured" : "standard"}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Simple pull quote (if we ever swap to real data, easy) ─── */}
      <section className="mx-auto max-w-4xl px-5 py-14">
        <blockquote className="relative rounded-3xl border border-border/70 bg-white p-8 text-center shadow-[var(--shadow-sm)] sm:p-12">
          <Quote className="mx-auto h-6 w-6 text-primary/40" />
          <p className="mt-4 text-xl font-medium leading-relaxed tracking-tight sm:text-2xl">
            &ldquo;Practical, warm, and never preachy. I recommend it to every
            new client.&rdquo;
          </p>
          <footer className="mt-5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              Ciara O&apos;Sullivan
            </span>
            {" "}— Speech &amp; Language Therapist
          </footer>
        </blockquote>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────── */}
      {allBadges.length > 0 && (
        <section className="border-t border-border/60 bg-white py-10">
          <div className="mx-auto max-w-6xl px-5">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trusted, accredited, evidence-based
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-6">
              {allBadges.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="h-10 w-auto opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ─────────────────────────────────────────────── */}
      <section className="bg-[#FBF8F3] py-14">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border/70 bg-white p-10 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Not sure where to start?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Book a short initial consultation and we&apos;ll help you find the
            right next step for your child — whether that&apos;s a course, a
            home programme, or something else.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:brightness-110"
            >
              <Video className="h-4 w-4" />
              Book a session
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Users className="h-4 w-4" />
              See all courses
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-[#FBF8F3] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} The Sensory Submarine</p>
          <div className="flex items-center gap-5">
            <Link href="/courses" className="hover:text-foreground">
              Courses
            </Link>
            <Link href="/book" className="hover:text-foreground">
              Book a session
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
