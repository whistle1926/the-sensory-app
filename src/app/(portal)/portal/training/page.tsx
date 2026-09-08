import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkCoursePayment } from "@/lib/course-payment-check";
import { redirect } from "next/navigation";
import {
  Award,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Clock,
  GraduationCap,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { TrainingCatalogue } from "@/components/training/training-catalogue";
import { PartnerCourseCard } from "@/components/training/partner-course-card";
import {
  cleanPartnerCourse,
  partnerCourseIsVisible,
} from "@/lib/partner-course";
import "./training.css";
import { coursesEnabled } from "@/lib/storefront";

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

  // If they paid and Fire settled late, this is where they come looking —
  // so re-check anything of theirs still pending before drawing the page.
  // Fire's open banking can take hours: Grace's payment confirmed nearly
  // eight hours after she started it, long after the thanks page was closed.
  try {
    const pending = await prisma.coursePurchase.findMany({
      where: {
        userId: session.user.id,
        paymentStatus: "pending",
        paymentRef: { not: null },
        createdAt: { gte: new Date(Date.now() - 14 * 864e5) },
      },
      select: { id: true },
      take: 5,
    });
    for (const p of pending) await checkCoursePayment(p.id);
  } catch {
    // Never let a payment check stop someone reaching their courses.
  }

  // Partner/external course promo (admin-editable in Settings → Storefront).
  const storefront = await prisma.storefrontConfig.findUnique({
    where: { id: "default" },
    select: { partnerCourse: true },
  });
  const partnerCourse = cleanPartnerCourse(storefront?.partnerCourse);
  const showPartnerCourse = partnerCourseIsVisible(partnerCourse);

  // Paused section → parents only see the individually-published courses.
  const sectionOn = await coursesEnabled();
  const courses = await prisma.course.findMany({
    where: sectionOn ? {} : { isLive: true, status: "AVAILABLE" },
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
      slug: course.slug,
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
    <div className="space-y-10 pb-16">
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
          <div className="mt-5">
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
          <div className="mt-5">
            <TrainingCatalogue courses={otherAvailable} />
          </div>
        </section>
      )}

      {/* ── Partner course (external, e.g. Little Sensory Explorers) ─ */}
      {showPartnerCourse && (
        <section>
          <SectionHeader
            icon={BadgeCheck}
            eyebrow="Go further"
            title="Accredited training from our partners"
          />
          <div className="mt-5">
            <PartnerCourseCard course={partnerCourse} />
          </div>
        </section>
      )}

      {/* ── Coming soon ────────────────────────────────────────────── */}
      {comingSoon.length > 0 && (
        <section>
          <SectionHeader icon={Clock} eyebrow="In the works" title="Coming soon" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {comingSoon.map((c) => (
              <div
                key={c.id}
                className="sub-edge flex gap-4 rounded-[26px] bg-white p-5"
              >
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#12235B] bg-[#FFE9A8]">
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
                  <span className="inline-flex rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                    Coming soon
                  </span>
                  <p className="sub-display mt-1.5 text-[18px] leading-tight line-clamp-1">
                    {c.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-relaxed text-[#3D4A6B]">
                    {c.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-bold text-[#6B7794]">
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

      {available.length === 0 && comingSoon.length === 0 && !showPartnerCourse && (
        <div className="sub-edge rounded-[26px] bg-white p-12 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#FFF3D2]">
            <GraduationCap className="h-8 w-8 text-[#12235B]" />
          </span>
          <p className="sub-display mt-4 text-2xl">
            No courses available yet
          </p>
          <p className="mt-2 text-[15px] font-semibold text-[#6B7794]">
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
    <section className="relative overflow-hidden rounded-[30px] border-[3px] border-[#0A1740] bg-[#12235B] text-white shadow-[8px_8px_0_#FFC93C]">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#17B0A7]/30"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-[#E71D57]/30"
        aria-hidden
      />
      <div className="relative grid gap-8 p-7 sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#FFC93C] bg-[#FFC93C] px-3 py-1 text-[12px] font-extrabold uppercase tracking-[1.2px] text-[#12235B]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E71D57]" aria-hidden />
            Your learning library
          </p>
          <h1 className="sub-display mt-5 text-[34px] leading-[1.05] tracking-[-1px] sm:text-[44px]">
            Practical, playful courses you can do at home
          </h1>
          <p className="mt-4 max-w-[540px] text-[16px] font-semibold leading-relaxed text-white/85 sm:text-[17px]">
            Evidence-based mini-courses from paediatric OT Grace Magennis.
            Bite-sized lessons, clear activities, strategies that fit into
            the day you already have.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-white/30 bg-white/10 px-3 py-1.5 text-[13px] font-bold">
              <Users className="h-4 w-4 text-[#FFC93C]" />
              Parents · Carers · Practitioners
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-white/30 bg-white/10 px-3 py-1.5 text-[13px] font-bold">
              <Clock className="h-4 w-4 text-[#17B0A7]" />
              Work at your own pace
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-white/30 bg-white/10 px-3 py-1.5 text-[13px] font-bold">
              <Award className="h-4 w-4 text-[#E71D57]" />
              Certificates on completion
            </span>
          </div>
        </div>
        <div
          className="hidden items-center justify-center md:flex"
          aria-hidden
        >
          <div className="sub-edge-lg flex h-36 w-36 items-center justify-center rounded-[36px] bg-[#FFC93C] text-[#12235B]">
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
    <section className="sub-edge-xl relative overflow-hidden rounded-[30px] bg-white">
      <div className="grid md:grid-cols-[1.2fr_1fr]">
        {/* Hero art */}
        <div className="relative order-first aspect-[16/9] border-b-[3px] border-[#12235B] bg-[#FFE9A8] md:order-last md:aspect-auto md:border-b-0 md:border-l-[3px]">
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={img}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="sub-display flex h-full w-full items-center justify-center text-5xl text-[#12235B]/50">
              {course.title.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-7 md:p-10">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-3 py-1 text-[12px] font-extrabold uppercase tracking-[1.2px]">
            <Play className="h-3 w-3 text-[#17B0A7]" />
            Continue learning
          </span>
          <div>
            <h2 className="sub-display text-[30px] leading-[1.05] tracking-[-1px] sm:text-[38px]">
              {course.title}
            </h2>
            {course.tagline && (
              <p className="mt-2 text-[15px] font-extrabold text-[#E71D57]">
                {course.tagline}
              </p>
            )}
            <p className="mt-3 max-w-lg text-[15px] font-semibold leading-relaxed text-[#3D4A6B] line-clamp-3">
              {richTextToPlain(course.description ?? "")}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px] font-bold text-[#6B7794]">
              <span>
                {course.completedModules} of {course.totalModules} modules
                complete
              </span>
              <span className="tabular-nums text-[#12235B]">
                {course.progressPercent}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border-2 border-[#12235B] bg-[#EADCC4]">
              <div
                className="h-full rounded-full bg-[#17B0A7] transition-all duration-500"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/portal/training/${course.id}`}
              className="sub-edge sub-press inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
              style={{ background: "var(--sub-pink)" }}
            >
              {course.enrollmentStatus === "COMPLETED"
                ? "Review course"
                : course.progressPercent > 0
                  ? "Continue where you left off"
                  : "Start your first lesson"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#6B7794]">
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
import { richTextToPlain } from "@/lib/rich-text";

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
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-3 py-1 text-[12px] font-extrabold uppercase tracking-[1.2px]">
          <Icon className="h-3.5 w-3.5 text-[#17B0A7]" />
          {eyebrow}
        </p>
        <h2 className="sub-display mt-3 text-2xl leading-tight sm:text-[28px]">{title}</h2>
      </div>
      {sub && (
        <p className="hidden shrink-0 text-[14px] font-bold text-[#6B7794] sm:block">{sub}</p>
      )}
    </div>
  );
}
