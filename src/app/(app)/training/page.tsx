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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[oklch(0.637_0.237_25.331)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Portal</h1>
          <p className="mt-1 text-sm text-[oklch(0.5_0.01_260)]">
            Online courses and CPD training for schools, parents, and professionals
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/training/progress"
            className="flex items-center gap-2 rounded-xl bg-[oklch(0.17_0.015_280)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[oklch(0.25_0.015_280)]"
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
            <div key={i} className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">{s.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[oklch(0.955_0.015_25)]">
                  <Icon className="h-4 w-4 text-[oklch(0.637_0.237_25.331)]" />
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
          <div key={course.id} className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[oklch(0.17_0.015_280)]">{course.title}</h3>
                    {course.enrollmentStatus === "COMPLETED" && (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700">
                        Completed
                      </span>
                    )}
                    {course.enrollmentStatus === "IN_PROGRESS" && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        In Progress
                      </span>
                    )}
                    {!course.enrollmentStatus && (
                      <span className="rounded-full bg-[oklch(0.955_0.015_25)] px-2.5 py-0.5 text-[10px] font-semibold text-[oklch(0.637_0.237_25.331)]">
                        Available
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[oklch(0.5_0.01_260)]">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.audience}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
                    <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {course.totalModules} modules</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[oklch(0.4_0.01_260)]">{course.description}</p>
                </div>
              </div>

              {/* Progress bar for enrolled courses */}
              {course.enrollmentStatus && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-[oklch(0.5_0.01_260)]">
                    <span>{course.completedModules} of {course.totalModules} modules completed</span>
                    <span className="font-semibold">{course.progressPercent}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[oklch(0.915_0.005_260)]">
                    <div
                      className="h-full rounded-full bg-[oklch(0.637_0.237_25.331)] transition-all duration-500"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[oklch(0.955_0.005_260)] bg-[oklch(0.975_0.002_260)] px-5 py-3 flex items-center gap-3">
              {!course.enrollmentStatus && (
                <button
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                  className="rounded-xl bg-[oklch(0.637_0.237_25.331)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[oklch(0.57_0.237_25.331)] disabled:opacity-50"
                >
                  <GraduationCap className="mr-2 inline h-4 w-4" />
                  {enrolling === course.id ? "Enrolling..." : "Start Course"}
                </button>
              )}
              {course.enrollmentStatus === "IN_PROGRESS" && (
                <Link
                  href={`/training/${course.id}`}
                  className="rounded-xl bg-[oklch(0.637_0.237_25.331)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[oklch(0.57_0.237_25.331)]"
                >
                  <Play className="mr-2 inline h-4 w-4" />
                  Continue
                </Link>
              )}
              {course.enrollmentStatus === "COMPLETED" && (
                <>
                  <Link
                    href={`/training/${course.id}`}
                    className="rounded-xl border border-[oklch(0.915_0.005_260)] bg-white px-4 py-2 text-sm font-semibold text-[oklch(0.17_0.015_280)] transition-colors hover:bg-[oklch(0.955_0.005_260)]"
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
          <h2 className="text-base font-semibold text-[oklch(0.5_0.01_260)]">Coming Soon</h2>
          {comingSoonCourses.map((course) => (
            <div key={course.id} className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm opacity-70">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[oklch(0.17_0.015_280)]">{course.title}</h3>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  Coming Soon
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[oklch(0.5_0.01_260)]">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.audience}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[oklch(0.4_0.01_260)]">{course.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
