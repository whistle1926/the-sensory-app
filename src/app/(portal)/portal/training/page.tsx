import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Award,
  ArrowRight,
  BookOpen,
  Clock,
  GraduationCap,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { TrainingCatalogue } from "@/components/training/training-catalogue";
import "./training.css";

export const dynamic = "force-dynamic";

/**
 * Portal training library.
 *
 * The parent's "course shelf" — not a boring list. Structure:
 *   1. Welcome hero (if not enrolled) or big Continue-learning card
 *      with the current course's artwork as the backdrop.
 *   2. Available courses — visual card grid (handled by TrainingCatalogue).
 *   3. Coming soon — pared-down teaser row.
 *
 * All course art comes from the `thumbnailUrl` / `heroImageUrl` fields
 * seeded earlier so there are no initials-tile placeholders.
 */
export default async function PortalTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/dashboard");

  const courses = await prisma.course.findMany({
    orderBy: [{ isFeatured: "desc" }, { order: "asc" }],
    include: {
      modules: { select: { id: true }, orderBy: { order: "asc" } },
      enrollments: {
        where: { userId: session.user.id },
        include: { moduleProgress: { select: { status: true } } },
      },
    },
  });

  const cards = courses.map((course) => {
    const enrollment = course.enrollments[0] ?? null;
    const totalModules = course.modules.length;
    const completedModules = enrollment
      ? enrollment.moduleProgress.filter(
          (mp) => mp.status === "COMPLETED",
        ).length
      : 0;
    return {
      id: course.id,
      title: course.title,
      audience: course.audience,
      duration: course.duration,
      description: course.description,
      status: course.status as "AVAILABLE" | "COMING_SOON" | "ARCHIVED",
      price: course.price,
      totalModules,
      enrollmentId: enrollment?.id ?? null,
      enrollmentStatus: (enrollment?.status ?? null) as
        | "IN_PROGRESS"
        | "COMPLETED"
        | null,
      completedModules,
      progressPercent:
        totalModules > 0
          ? Math.round((completedModules / totalModules) * 100)
          : 0,
      thumbnailUrl: course.thumbnailUrl,
      heroImageUrl: course.heroImageUrl,
      isBestseller: course.isBestseller,
      tagline: course.tagline,
    };
  });

  const available = cards.filter((c) => c.status === "AVAILABLE");
  const comingSoon = cards.filter((c) => c.status === "COMING_SOON");
  const enrolled = available.filter((c) => c.enrollmentStatus);
  const currentCourse =
    enrolled.find((c) => c.enrollmentStatus === "IN_PROGRESS") ??
    enrolled[0] ??
    null;
  const otherAvailable = available.filter((c) => !c.enrollmentStatus);

  return (
    <div className="space-y-8">
      {/* ── Hero: Continue learning OR welcome ────────────────────── */}
      {currentCourse ? (
        <ContinueCard course={currentCourse} />
      ) : (
        <WelcomeHero />
      )}

      {/* ── Other enrolled courses (completed / additional) ───────── */}
      {enrolled.filter((c) => c.id !== currentCourse?.id).length > 0 && (
        <section>
          <SectionHeader
            icon={Award}
            eyebrow="Your library"
            title={`Your other enrolments (${enrolled.filter((c) => c.id !== currentCourse?.id).length})`}
          />
          <div className="mt-4">
            <TrainingCatalogue
              courses={enrolled.filter((c) => c.id !== currentCourse?.id)}
            />
          </div>
        </section>
      )}

      {/* ── Available courses ──────────────────────────────────────── */}
      {otherAvailable.length > 0 && (
        <section>
          <SectionHeader
            icon={Sparkles}
            eyebrow="Browse the library"
            title="Courses for parents and practitioners"
            sub={`${otherAvailable.length} ${otherAvailable.length === 1 ? "course" : "courses"} available`}
          />
          <div className="mt-4">
            <TrainingCatalogue courses={otherAvailable} />
          </div>
        </section>
      )}

      {/* ── Coming soon ────────────────────────────────────────────── */}
      {comingSoon.length > 0 && (
        <section>
          <SectionHeader icon={Clock} eyebrow="In the works" title="Coming soon" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {comingSoon.map((c) => (
              <div
                key={c.id}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4 opacity-80"
              >
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-primary/20">
                  {c.thumbnailUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover grayscale"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold line-clamp-1">
                    {c.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.audience}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {c.duration}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {available.length === 0 && comingSoon.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold">
            No courses available yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back soon — new courses are on the way.
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function WelcomeHero() {
  return (
    <section className="lp-course-hero">
      <div className="lp-course-hero-art" />
      <div className="lp-course-hero-inner">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--primary)" }}
          >
            Your learning library
          </p>
          <h1 className="lp-hero-title mt-2">
            Practical, playful courses you can do at home
          </h1>
          <p className="lp-hero-sub">
            Evidence-based mini-courses from paediatric OT Patrick Farren.
            Bite-sized lessons, clear activities, strategies that fit into
            the day you already have.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Parents · Carers · Practitioners
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Work at your own pace
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              Certificates on completion
            </span>
          </div>
        </div>
        <div
          className="hidden items-center justify-center md:flex"
          aria-hidden
        >
          <div className="flex h-36 w-36 items-center justify-center rounded-[36px] bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[var(--shadow-lg)]">
            <BookOpen className="h-14 w-14" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

interface CourseCardData {
  id: string;
  title: string;
  tagline?: string | null;
  description: string;
  duration: string;
  totalModules: number;
  completedModules: number;
  progressPercent: number;
  enrollmentStatus: "IN_PROGRESS" | "COMPLETED" | null;
  thumbnailUrl?: string | null;
  heroImageUrl?: string | null;
}

function ContinueCard({ course }: { course: CourseCardData }) {
  const img = course.heroImageUrl ?? course.thumbnailUrl ?? null;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="grid md:grid-cols-[1.2fr_1fr]">
        {/* Hero art */}
        <div className="relative order-first aspect-[16/9] md:order-last md:aspect-auto">
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={img}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/40 text-5xl font-black text-primary/50">
              {course.title.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent md:bg-gradient-to-l"
            aria-hidden
          />
        </div>

        {/* Body */}
        <div className="flex flex-col justify-center gap-5 p-7 md:p-10">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            <Play className="h-3 w-3" />
            Continue learning
          </span>
          <div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              {course.title}
            </h2>
            {course.tagline && (
              <p className="mt-1.5 text-sm font-medium text-primary">
                {course.tagline}
              </p>
            )}
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {course.description}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {course.completedModules} of {course.totalModules} modules
                complete
              </span>
              <span className="font-semibold tabular-nums">
                {course.progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/portal/training/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[var(--shadow-md)]"
            >
              {course.enrollmentStatus === "COMPLETED"
                ? "Review course"
                : course.progressPercent > 0
                  ? "Continue where you left off"
                  : "Start your first lesson"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {course.duration}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

import type { LucideIcon } from "lucide-react";

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  sub,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--primary)" }}
        >
          <Icon className="h-3.5 w-3.5" />
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {sub && (
        <p className="hidden text-xs text-muted-foreground sm:block">{sub}</p>
      )}
    </div>
  );
}
