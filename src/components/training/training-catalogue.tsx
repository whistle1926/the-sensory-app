"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, Play, GraduationCap, Award, CheckCircle2 } from "lucide-react";

interface Course {
  id: string;
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
}

interface Props {
  courses: Course[];
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function TrainingCatalogue({ courses }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
      <p className="text-sm text-muted-foreground">No courses available right now.</p>
    );
  }

  return (
    <div className="space-y-3">
      {courses.map((course) => {
        const isFree = course.price === 0;
        const isEnrolled = !!course.enrollmentStatus;
        const isCompleted = course.enrollmentStatus === "COMPLETED";
        return (
          <Card key={course.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{course.title}</h3>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/50 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </span>
                    )}
                    {!isEnrolled && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                        {isFree ? "Free" : gbp.format(course.price)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {course.audience}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {course.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" /> {course.totalModules} modules
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {course.description}
                  </p>
                </div>
              </div>

              {errorId === course.id && errorMessage && (
                <p className="mt-3 text-xs text-red-600">{errorMessage}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {!isEnrolled && (
                  <Button
                    type="button"
                    onClick={() => handleStart(course.id)}
                    disabled={busyId === course.id}
                  >
                    <GraduationCap className="mr-1.5 h-4 w-4" />
                    {busyId === course.id
                      ? "Starting…"
                      : isFree
                      ? "Start course"
                      : `Buy · ${gbp.format(course.price)}`}
                  </Button>
                )}
                {isEnrolled && !isCompleted && (
                  <Link
                    href={`/portal/training/${course.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                  >
                    <Play className="h-4 w-4" /> Continue
                  </Link>
                )}
                {isCompleted && (
                  <>
                    <Link
                      href={`/portal/training/${course.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      <Play className="h-4 w-4" /> Review
                    </Link>
                    {course.enrollmentId && (
                      <a
                        href={`/api/training/certificate/${course.enrollmentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <Award className="h-4 w-4" /> Certificate
                      </a>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
