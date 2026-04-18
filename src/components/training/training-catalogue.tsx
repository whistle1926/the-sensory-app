"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  CheckCircle2,
  Clock,
  GraduationCap,
  Info,
  Play,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseInfoDialog } from "./course-info-dialog";

interface Course {
  id: string;
  slug: string;
  title: string;
  audience: string;
  duration: string;
  description: string;
  price: number;
  totalModules: number;
  enrollmentId: string | null;
  enrollmentStatus: "IN_PROGRESS" | "COMPLETED" | null;
  completedModules: number;
  progressPercent: number;
  thumbnailUrl?: string | null;
  heroImageUrl?: string | null;
  isBestseller?: boolean;
  tagline?: string | null;
}

interface Props {
  courses: Course[];
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * Catalogue grid for the portal training library. Visual-first cards with
 * course artwork, tagline, metadata, and primary CTA. Sits alongside the
 * enrolled-course rail above it — this is the browse surface.
 */
export function TrainingCatalogue({ courses }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoCourseId, setInfoCourseId] = useState<string | null>(null);
  const infoCourse =
    infoCourseId != null
      ? courses.find((c) => c.id === infoCourseId) ?? null
      : null;

  async function handleStart(courseId: string) {
    setBusyId(courseId);
    setErrorId(null);
    setErrorMessage("");
    try {
      const res = await fetch("/api/portal/training/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorId(courseId);
        setErrorMessage(data.error || "Couldn't start this course.");
        setBusyId(null);
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setErrorId(courseId);
      setErrorMessage("Network error. Please try again.");
    }
    setBusyId(null);
  }

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No courses available right now.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => {
        const isFree = course.price === 0;
        const isEnrolled = !!course.enrollmentStatus;
        const isCompleted = course.enrollmentStatus === "COMPLETED";
        const img = course.thumbnailUrl ?? course.heroImageUrl ?? null;
        const initials = course.title.slice(0, 2).toUpperCase();
        return (
          <div
            key={course.id}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-sm)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"
          >
            {/* Cover art */}
            <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/15 to-primary/30">
              {img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-black text-primary/40">
                  {initials}
                </div>
              )}

              {/* Corner chips */}
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {course.isBestseller && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    Bestseller
                  </span>
                )}
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                  </span>
                ) : isEnrolled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                    <Play className="h-3 w-3" /> Enrolled
                  </span>
                ) : null}
              </div>

              <div className="absolute right-3 top-3">
                <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-sm">
                  {isFree ? "Free" : gbp.format(course.price)}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-base font-bold tracking-tight line-clamp-2">
                {course.title}
              </h3>
              {course.tagline && (
                <p className="mt-1 line-clamp-1 text-xs font-medium text-primary">
                  {course.tagline}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {course.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {course.audience}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {course.duration}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {course.totalModules}
                </span>
              </div>

              {isEnrolled && !isCompleted && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {course.completedModules}/{course.totalModules} modules
                    </span>
                    <span className="font-semibold tabular-nums">
                      {course.progressPercent}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {errorId === course.id && errorMessage && (
                <p className="mt-3 text-xs text-red-600">{errorMessage}</p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {!isEnrolled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setInfoCourseId(course.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      title="See what's inside"
                    >
                      <Info className="h-3.5 w-3.5" />
                      Info
                    </button>
                    <Button
                      type="button"
                      onClick={() => handleStart(course.id)}
                      disabled={busyId === course.id}
                      className="flex-1"
                    >
                      <GraduationCap className="mr-1.5 h-4 w-4" />
                      {busyId === course.id
                        ? "Starting…"
                        : isFree
                          ? "Start course"
                          : `Buy · ${gbp.format(course.price)}`}
                    </Button>
                  </>
                ) : !isCompleted ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setInfoCourseId(course.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      title="Course info"
                    >
                      <Info className="h-3.5 w-3.5" />
                      Info
                    </button>
                    <Link
                      href={`/portal/training/${course.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
                    >
                      <Play className="h-4 w-4" /> Continue
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/portal/training/${course.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
                    >
                      <Play className="h-3.5 w-3.5" /> Review
                    </Link>
                    {course.enrollmentId && (
                      <a
                        href={`/api/training/certificate/${course.enrollmentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <Award className="h-3.5 w-3.5" /> Certificate
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Info modal — only one is rendered at a time. Course is pulled out
          of the list so the dialog can call back into handleStart with the
          right id. */}
      {infoCourse && (
        <CourseInfoDialog
          open={!!infoCourse}
          onOpenChange={(open) => {
            if (!open) setInfoCourseId(null);
          }}
          slug={infoCourse.slug}
          primaryAction={(() => {
            if (infoCourse.enrollmentStatus === "COMPLETED") {
              return {
                label: "Review course",
                href: `/portal/training/${infoCourse.id}`,
              };
            }
            if (infoCourse.enrollmentStatus === "IN_PROGRESS") {
              return {
                label: "Continue",
                href: `/portal/training/${infoCourse.id}`,
              };
            }
            return {
              label: busyId === infoCourse.id
                ? "Starting…"
                : infoCourse.price === 0
                  ? "Start course"
                  : `Buy · ${gbp.format(infoCourse.price)}`,
              onClick: () => handleStart(infoCourse.id),
              loading: busyId === infoCourse.id,
            };
          })()}
        />
      )}
    </div>
  );
}
