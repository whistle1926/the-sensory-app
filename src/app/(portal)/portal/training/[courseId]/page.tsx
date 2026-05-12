import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  PlayCircle,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import "../training.css";

export const dynamic = "force-dynamic";

type ModuleStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

function statusIcon(status: ModuleStatus) {
  const base = "h-4 w-4 shrink-0";
  switch (status) {
    case "LOCKED":
      return <Lock className={`${base} text-muted-foreground`} />;
    case "IN_PROGRESS":
      return <Circle className={`${base} text-primary`} />;
    case "COMPLETED":
      return <CheckCircle2 className={`${base} text-green-600`} />;
    case "FAILED":
      return <XCircle className={`${base} text-red-500`} />;
  }
}

function statusLabel(status: ModuleStatus, score: number | null): string {
  switch (status) {
    case "LOCKED":
      return "Locked";
    case "IN_PROGRESS":
      return "Ready";
    case "COMPLETED":
      return score != null ? `Passed · ${score}%` : "Completed";
    case "FAILED":
      return "Try again";
  }
}

/**
 * Course landing page (portal / CLIENT view).
 *
 * Redesigned as a warm, focused course hub:
 *   - Hero with course title, description, progress ring, primary CTA
 *   - Module grid with clear status chips
 *   - Certificate callout on completion
 */
export default async function PortalCourseLandingPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/dashboard");

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          videoUrl: true,
          coverImageUrl: true,
        },
      },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: {
            select: {
              moduleId: true,
              status: true,
              score: true,
              completedAt: true,
            },
          },
        },
      },
      // Optional recommendation shown on the completion screen — pulled
      // along with the course so the "Continue your learning" card
      // renders without a second round-trip.
      nextCourse: {
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          shortDescription: true,
          thumbnailUrl: true,
          heroImageUrl: true,
          price: true,
        },
      },
    },
  });

  if (!course) notFound();
  const enrollment = course.enrollments[0] ?? null;
  if (!enrollment) redirect("/portal/training");

  const progressMap = new Map(
    enrollment.moduleProgress.map((mp) => [mp.moduleId, mp]),
  );
  const modules = course.modules.map((m) => {
    const p = progressMap.get(m.id);
    return {
      ...m,
      status: (p?.status ?? "LOCKED") as ModuleStatus,
      score: p?.score ?? null,
      hasVideo: !!m.videoUrl,
    };
  });

  const completedCount = modules.filter(
    (m) => m.status === "COMPLETED",
  ).length;
  const progressPercent =
    modules.length > 0
      ? Math.round((completedCount / modules.length) * 100)
      : 0;

  // First incomplete module is the primary "Continue" target
  const nextModule =
    modules.find((m) => m.status === "IN_PROGRESS" || m.status === "FAILED") ??
    modules[0];

  const isComplete = enrollment.status === "COMPLETED";
  // Progress ring geometry
  const ringSize = 140;
  const ringStroke = 12;
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/training"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to training
      </Link>

      {/* Hero */}
      <section className="lp-course-hero">
        <div className="lp-course-hero-art" />
        <div className="lp-course-hero-inner">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "var(--primary)" }}
            >
              {isComplete ? "Course complete" : "Your course"}
            </p>
            <h1 className="lp-hero-title mt-2">{course.title}</h1>
            {course.description && (
              <p className="lp-hero-sub">{course.description}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {course.audience}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4" />
                {modules.length} module{modules.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {isComplete ? (
                <>
                  <a
                    href={`/api/training/certificate/${enrollment.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-[var(--shadow-md)]"
                  >
                    <Award className="h-4 w-4" />
                    Download certificate
                  </a>
                  {nextModule && (
                    <Link
                      href={`/portal/training/${course.id}/${nextModule.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      Review course
                    </Link>
                  )}
                </>
              ) : nextModule ? (
                <Link
                  href={`/portal/training/${course.id}/${nextModule.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[var(--shadow-md)]"
                >
                  {progressPercent > 0
                    ? `Continue · Module ${nextModule.order + 1}`
                    : "Start course"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          {/* Progress ring */}
          <div className="lp-ring" aria-hidden>
            <svg width={ringSize} height={ringSize}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={ringStroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="url(#ring-grad)"
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 600ms ease" }}
              />
              <defs>
                <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="oklch(0.5 0.24 264)" />
                  <stop offset="100%" stopColor="oklch(0.45 0.2 280)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="ring-center">
              <span className="ring-pct">{progressPercent}%</span>
              <span className="ring-label">
                {completedCount} / {modules.length}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* "Continue your learning" — only renders when this course is
          complete AND the admin has set a `nextCourseId`. Falls back to
          a soft link to /courses when no recommendation is configured. */}
      {isComplete && (
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-[var(--shadow-sm)]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Continue your learning
          </p>
          {course.nextCourse ? (
            <Link
              href={`/courses/${course.nextCourse.slug}`}
              className="mt-3 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-[var(--shadow-md)] sm:flex-row sm:items-center"
            >
              {(course.nextCourse.thumbnailUrl ||
                course.nextCourse.heroImageUrl) && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={
                    course.nextCourse.thumbnailUrl ??
                    course.nextCourse.heroImageUrl ??
                    ""
                  }
                  alt=""
                  className="h-24 w-full shrink-0 rounded-xl object-cover sm:w-32"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold tracking-tight">
                  {course.nextCourse.title}
                </h3>
                {course.nextCourse.tagline && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {course.nextCourse.tagline}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {course.nextCourse.price === 0
                    ? "Free"
                    : `£${course.nextCourse.price}`}
                </p>
              </div>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
            </Link>
          ) : (
            <Link
              href="/courses"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              See all courses <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>
      )}

      {/* Modules grid */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles
            className="h-4 w-4"
            style={{ color: "var(--primary)" }}
          />
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Modules — {modules.length} total
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => {
            const locked = m.status === "LOCKED";
            const complete = m.status === "COMPLETED";
            const isCurrent = nextModule?.id === m.id && !complete;
            const classes = [
              "lp-module-card",
              complete ? "is-complete" : "",
              locked ? "is-locked" : "",
              isCurrent ? "is-current" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const inner = (
              <>
                {/* Cover art */}
                <div className="relative -mx-5 -mt-5 mb-2 aspect-[16/9] overflow-hidden rounded-t-2xl bg-gradient-to-br from-primary/15 to-primary/30">
                  {m.coverImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.coverImageUrl}
                      alt={m.title}
                      className={`h-full w-full object-cover ${locked ? "grayscale" : ""}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl font-black text-primary/40">
                      {i + 1}
                    </div>
                  )}
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Lock className="h-8 w-8 text-white/80" />
                    </div>
                  )}
                  {m.hasVideo && !locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-md">
                        <PlayCircle className="h-7 w-7 text-primary" />
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">
                      <PlayCircle className="h-3 w-3" /> Up next
                    </span>
                  )}
                  {complete && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                      <CheckCircle2 className="h-3 w-3" /> Complete
                    </span>
                  )}
                  {m.hasVideo && (
                    <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      <PlayCircle className="h-3 w-3" /> Video
                    </span>
                  )}
                </div>

                <div className="lp-module-head">
                  <span className="lp-module-num">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="title">{m.title}</p>
                    <p className="sub">{statusLabel(m.status, m.score)}</p>
                  </div>
                  {!locked && !complete && statusIcon(m.status)}
                </div>
              </>
            );
            return locked ? (
              <div key={m.id} className={classes}>
                {inner}
              </div>
            ) : (
              <Link
                key={m.id}
                href={`/portal/training/${course.id}/${m.id}`}
                className={`group ${classes}`}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
