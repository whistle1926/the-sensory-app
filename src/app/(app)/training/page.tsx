"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Clock, Users, Award, BookOpen, Play, BarChart3 } from "lucide-react";
import Link from "next/link";

interface CourseData {
  id: string;
  title: string;
  slug: string;
  audience: string;
  duration: string;
  description: string;
  status: "AVAILABLE" | "COMING_SOON" | "ARCHIVED";
  totalModules: number;
  enrollmentStatus: "IN_PROGRESS" | "COMPLETED" | null;
  enrollmentId: string | null;
  completedModules: number;
  progressPercent: number;
}

export default function TrainingPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then((data) => {
      setCourses(data);
      setLoading(false);
    });
    fetch("/api/auth/session").then((r) => r.json()).then((s) => {
      setUserRole(s?.user?.role ?? null);
    });
  }, []);

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    const res = await fetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
    if (res.ok) {
      const updated = await fetch("/api/courses").then((r) => r.json());
      setCourses(updated);
    }
    setEnrolling(null);
  };

  const availableCourses = courses.filter((c) => c.status === "AVAILABLE");
  const comingSoonCourses = courses.filter((c) => c.status === "COMING_SOON");
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "TEAM_MANAGER";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Online courses and CPD training for schools, parents, and professionals
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/training/progress"
            className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-foreground/80"
          >
            <BarChart3 className="h-4 w-4" />
            Learner Progress
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: BookOpen, label: "Courses", value: availableCourses.length },
          { icon: Users, label: "Audiences", value: "3" },
          { icon: Award, label: "CPD Accredited", value: "2" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Available Courses */}
      <div className="space-y-4">
        {availableCourses.map((course) => (
          <div key={course.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{course.title}</h3>
                    {course.enrollmentStatus === "COMPLETED" && (
                      <span className="rounded-full bg-green-50 dark:bg-green-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
                        Completed
                      </span>
                    )}
                    {course.enrollmentStatus === "IN_PROGRESS" && (
                      <span className="rounded-full bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                        In Progress
                      </span>
                    )}
                    {!course.enrollmentStatus && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                        Available
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.audience}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
                    <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {course.totalModules} modules</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{course.description}</p>
                </div>
              </div>

              {/* Progress bar for enrolled courses */}
              {course.enrollmentStatus && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{course.completedModules} of {course.totalModules} modules completed</span>
                    <span className="font-semibold">{course.progressPercent}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-background px-5 py-3 flex items-center gap-3">
              {!course.enrollmentStatus && (
                <button
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
                >
                  <GraduationCap className="mr-2 inline h-4 w-4" />
                  {enrolling === course.id ? "Enrolling..." : "Start Course"}
                </button>
              )}
              {course.enrollmentStatus === "IN_PROGRESS" && (
                <Link
                  href={`/training/${course.id}`}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                >
                  <Play className="mr-2 inline h-4 w-4" />
                  Continue
                </Link>
              )}
              {course.enrollmentStatus === "COMPLETED" && (
                <>
                  <Link
                    href={`/training/${course.id}`}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <BookOpen className="mr-2 inline h-4 w-4" />
                    Review
                  </Link>
                  <a
                    href={`/api/training/certificate/${course.enrollmentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <Award className="mr-2 inline h-4 w-4" />
                    View Certificate
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Coming Soon */}
      {comingSoonCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-muted-foreground">Coming Soon</h2>
          {comingSoonCourses.map((course) => (
            <div key={course.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm opacity-70">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{course.title}</h3>
                <span className="rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  Coming Soon
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.audience}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{course.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
