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
import { richTextToPlain } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

type ModuleStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

function statusIcon(status: ModuleStatus) {
  const base = "h-4 w-4 shrink-0";
  switch (status) {
    case "LOCKED":
      return <Lock className={`${base} text-[#6B7794]`} />;
    case "IN_PROGRESS":
      return <Circle className={`${base} text-[#E71D57]`} />;
    case "COMPLETED":
      return <CheckCircle2 className={`${base} text-[#17B0A7]`} />;
    case "FAILED":
      return <XCircle className={`${base} text-[#E71D57]`} />;
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

/* Module tiles cycle through the three brand accents so a long list
   doesn't read as a wall of identical squares. Completed modules always
   wear teal so the "done" signal is consistent. */
const tileTones = [
  "bg-[#17B0A7] text-white",
  "bg-[#E71D57] text-white",
  "bg-[#FFC93C] text-[#12235B]",
];

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
    <div className="space-y-8">
      <Link
        href="/portal/training"
        className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#6B7794] transition-colors hover:text-[#12235B]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to training
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[34px] border-[3px] border-[#0A1740] bg-[#12235B] text-white shadow-[8px_8px_0_#FFC93C]">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5"
          aria-hidden
        />
        <div className="relative grid gap-8 p-7 sm:p-10 md:grid-cols-[1.5fr_auto] md:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFC93C] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[1.4px] text-[#12235B]">
              {isComplete ? "Course complete" : "Your course"}
            </span>
            <h1 className="sub-display mt-4 text-[34px] leading-[1.08] tracking-[-1px] text-white sm:text-[44px]">
              {course.title}
            </h1>
            {course.description && (
              <p className="mt-3 max-w-[560px] text-[15.5px] leading-[1.65] text-[#C6D0EA]">
                {richTextToPlain(course.description ?? "")}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#C6D0EA]">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#FFC93C]" />
                {course.audience}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#FFC93C]" />
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-[#FFC93C]" />
                {modules.length} module{modules.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {isComplete ? (
                <>
                  {/* Only where the course actually awards one. A short
                      parent webinar isn't accredited training, and offering
                      a certificate for it devalues the ones that are. The
                      switch is "Give a certificate on completion" in the
                      course editor — it was being ignored here. */}
                  {course.hasCertificate && (
                  <a
                    href={`/api/training/certificate/${enrollment.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sub-press inline-flex items-center gap-2 rounded-full border-[3px] border-[#0A1740] bg-[#FFC93C] px-6 py-3.5 text-[15px] font-extrabold text-[#12235B] shadow-[3px_3px_0_#0A1740]"
                  >
                    <Award className="h-4 w-4" />
                    Download certificate
                  </a>
                  )}
                  {nextModule && (
                    <Link
                      href={`/portal/training/${course.id}/${nextModule.id}`}
                      className="sub-press inline-flex items-center gap-2 rounded-full border-[3px] border-[#0A1740] bg-white px-6 py-3.5 text-[15px] font-extrabold text-[#12235B] shadow-[3px_3px_0_#0A1740]"
                    >
                      Review course
                    </Link>
                  )}
                </>
              ) : nextModule ? (
                <Link
                  href={`/portal/training/${course.id}/${nextModule.id}`}
                  className="sub-press inline-flex items-center gap-2 rounded-full border-[3px] border-[#0A1740] px-6 py-3.5 text-[15px] font-extrabold text-white shadow-[3px_3px_0_#FFC93C]"
                  style={{ background: "var(--sub-pink)" }}
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
          <div
            className="relative mx-auto h-[140px] w-[140px] shrink-0 md:mx-0"
            aria-hidden
          >
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={ringStroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="#FFC93C"
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 600ms ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="sub-display text-[32px] leading-none tabular-nums text-white">
                {progressPercent}%
              </span>
              <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#C6D0EA]">
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
        <section className="sub-edge rounded-[26px] bg-white p-6 sm:p-7">
          <span className="inline-flex items-center rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-3 py-1 text-[13px] font-bold text-[#12235B]">
            Continue your learning
          </span>
          {course.nextCourse ? (
            <Link
              href={`/courses/${course.nextCourse.slug}`}
              className="sub-press mt-4 flex flex-col gap-4 rounded-[20px] border-[3px] border-[#12235B] bg-[#FFFCF6] p-5 sm:flex-row sm:items-center"
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
                  className="h-24 w-full shrink-0 rounded-[14px] border-2 border-[#12235B] object-cover sm:w-32"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="sub-display text-[21px] leading-tight">
                  {course.nextCourse.title}
                </h3>
                {course.nextCourse.tagline && (
                  <p className="mt-1 text-[15px] text-[#3D4A6B]">
                    {course.nextCourse.tagline}
                  </p>
                )}
                <p className="mt-2 text-sm font-bold text-[#6B7794]">
                  {course.nextCourse.price === 0
                    ? "Free"
                    : `£${course.nextCourse.price}`}
                </p>
              </div>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-[#E71D57] sm:block" />
            </Link>
          ) : (
            <Link
              href="/courses"
              className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-extrabold text-[#E71D57] hover:underline"
            >
              See all courses <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>
      )}

      {/* Modules list */}
      <section>
        <div className="mb-5 flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-[#E71D57]" />
          <h2 className="sub-display text-2xl">
            Modules
            <span className="ml-2 text-base font-bold text-[#6B7794]">
              {modules.length} total
            </span>
          </h2>
        </div>

        <div className="space-y-4">
          {modules.map((m, i) => {
            const locked = m.status === "LOCKED";
            const complete = m.status === "COMPLETED";
            const isCurrent = nextModule?.id === m.id && !complete;
            const classes = [
              "flex items-center gap-4 rounded-[26px] bg-white p-4 sm:p-5",
              locked
                ? "border-[3px] border-[#D9D2C4] opacity-70 cursor-not-allowed"
                : "sub-edge sub-press",
              isCurrent ? "ring-4 ring-[#FFC93C]/60" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const tile = complete
              ? "bg-[#17B0A7] text-white"
              : locked
                ? "bg-[#EADCC4] text-[#6B7794]"
                : tileTones[i % tileTones.length];
            const inner = (
              <>
                {/* Icon tile */}
                <span
                  className={`sub-display flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border-[3px] border-[#12235B] text-xl ${tile}`}
                >
                  {complete ? (
                    <CheckCircle2 className="h-7 w-7" />
                  ) : locked ? (
                    <Lock className="h-6 w-6" />
                  ) : (
                    i + 1
                  )}
                </span>

                {/* Cover art — a small thumb beside the title where one
                    is set; hidden on narrow screens to keep the row tidy. */}
                {m.coverImageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.coverImageUrl}
                    alt=""
                    className={`hidden h-16 w-24 shrink-0 rounded-[12px] border-2 border-[#12235B] object-cover sm:block ${locked ? "grayscale" : ""}`}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="sub-display text-[17px] leading-tight sm:text-[19px]">
                    {m.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#6B7794]">
                      {!locked && !complete && statusIcon(m.status)}
                      {statusLabel(m.status, m.score)}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#0A1740] bg-[#E71D57] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                        <PlayCircle className="h-3 w-3" /> Up next
                      </span>
                    )}
                    {complete && (
                      <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-2.5 py-0.5 text-[11px] font-bold text-[#12235B]">
                        <CheckCircle2 className="h-3 w-3 text-[#17B0A7]" /> Complete
                      </span>
                    )}
                    {m.hasVideo && (
                      <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-2.5 py-0.5 text-[11px] font-bold text-[#12235B]">
                        <PlayCircle className="h-3 w-3" /> Video
                      </span>
                    )}
                  </div>
                </div>

                {!locked && (
                  <ArrowRight className="hidden h-5 w-5 shrink-0 text-[#E71D57] sm:block" />
                )}
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
