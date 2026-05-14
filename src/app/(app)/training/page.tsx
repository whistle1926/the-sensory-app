"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  Clock,
  GraduationCap,
  Play,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

interface CourseData {
  id: string;
  title: string;
  slug: string;
  audience: string;
  duration: string;
  description: string;
  status: "AVAILABLE" | "COMING_SOON" | "ARCHIVED";
  totalModules: number;
  price: number;
  isFeatured: boolean;
  isBestseller: boolean;
  enrollmentStatus: "IN_PROGRESS" | "COMPLETED" | null;
  enrollmentId: string | null;
  completedModules: number;
  progressPercent: number;
}

/**
 * Training Portal (admin + team view). KPI strip up top, available courses
 * below in Panels, Coming Soon below that.
 */
export default function TrainingPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        setCourses(data);
        setLoading(false);
      });
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        setUserRole(s?.user?.role ?? null);
      });
  }, []);

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    const res = await fetch(`/api/courses/${courseId}/enroll`, {
      method: "POST",
    });
    if (res.ok) {
      const updated = await fetch("/api/courses").then((r) => r.json());
      setCourses(updated);
    }
    setEnrolling(null);
  };

  const availableCourses = courses.filter((c) => c.status === "AVAILABLE");
  const comingSoonCourses = courses.filter((c) => c.status === "COMING_SOON");
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "TEAM_MANAGER";

  const kpis = [
    {
      label: "Available",
      value: String(availableCourses.length),
      helper: `${comingSoonCourses.length} coming soon`,
      icon: BookOpen,
    },
    {
      label: "In progress",
      value: String(
        courses.filter((c) => c.enrollmentStatus === "IN_PROGRESS").length,
      ),
      helper: "Your enrolments",
      icon: Play,
    },
    {
      label: "Completed",
      value: String(
        courses.filter((c) => c.enrollmentStatus === "COMPLETED").length,
      ),
      helper: "With certificate",
      icon: Award,
    },
    {
      label: "Audiences",
      value: String(
        new Set(courses.map((c) => c.audience)).size || 0,
      ),
      helper: "Parents / pros / schools",
      icon: Users,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Toolbar
          title="Training Portal"
          subtitle="Online courses and CPD training for schools, parents, and professionals"
        />
        <Panel>
          <Empty>Loading courses…</Empty>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar
        title="Training Portal"
        subtitle="Online courses and CPD training for schools, parents, and professionals"
        actions={
          isAdmin && (
            <Link
              href="/training/progress"
              className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-foreground/80"
            >
              <BarChart3 className="h-4 w-4" />
              Learner Progress
            </Link>
          )
        }
      />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="ds-kpi">
              <div className="ds-kpi-head">
                <span className="ds-kpi-label">{k.label}</span>
                <span className="ds-kpi-icon">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <span className="ds-kpi-value ds-tabular">{k.value}</span>
              <div className="ds-kpi-foot">
                <span>{k.helper}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin manage panel — staff only. Quick view of every course,
          including ARCHIVED, with search + edit shortcuts. */}
      {isAdmin && (
        <AdminManagePanel courses={courses} onRefresh={() => {
          fetch("/api/courses").then((r) => r.json()).then(setCourses);
        }} />
      )}

      {/* Available Courses */}
      <Panel
        title="Available courses"
        subtitle={`${availableCourses.length} course${availableCourses.length === 1 ? "" : "s"}`}
      >
        {availableCourses.length === 0 ? (
          <Empty>No courses available yet.</Empty>
        ) : (
          <div className="divide-y divide-border">
            {availableCourses.map((course) => (
              <div key={course.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {course.title}
                      </h3>
                      {course.enrollmentStatus === "COMPLETED" && (
                        <Chip tone="success">Completed</Chip>
                      )}
                      {course.enrollmentStatus === "IN_PROGRESS" && (
                        <Chip tone="info">In progress</Chip>
                      )}
                      {!course.enrollmentStatus && (
                        <Chip tone="primary">Available</Chip>
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
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {course.description}
                    </p>

                    {course.enrollmentStatus && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {course.completedModules} of {course.totalModules}{" "}
                            modules completed
                          </span>
                          <span className="font-semibold ds-tabular">
                            {course.progressPercent}%
                          </span>
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

                  <div className="flex flex-col items-end gap-2">
                    {!course.enrollmentStatus && (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrolling === course.id}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
                      >
                        <GraduationCap className="mr-2 inline h-4 w-4" />
                        {enrolling === course.id ? "Enrolling…" : "Start"}
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
                          Certificate
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Coming Soon */}
      {comingSoonCourses.length > 0 && (
        <Panel title="Coming soon" subtitle="Not yet available">
          <div className="divide-y divide-border">
            {comingSoonCourses.map((course) => (
              <div key={course.id} className="px-5 py-4 opacity-80">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {course.title}
                  </h3>
                  <Chip tone="warn">Coming soon</Chip>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {course.audience}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {course.duration}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {course.description}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Admin manage panel — search + per-row status/price toggle + edit link.
// Renders ALL courses, including ARCHIVED (which are hidden from the
// "Available" / "Coming Soon" sections below).
// ──────────────────────────────────────────────────────────────────────
function AdminManagePanel({
  courses,
  onRefresh,
}: {
  courses: CourseData[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const filtered = courses.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.audience ?? "").toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q)
    );
  });

  async function quickPatch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          Manage courses
        </span>
      }
      subtitle="Edit content, flip status, change price, toggle featured/bestseller."
      actions={
        <div className="flex items-center gap-2">
          <div className="relative w-64 max-w-full">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses…"
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <Chip tone="primary" dot={false}>
            {filtered.length}/{courses.length}
          </Chip>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <Empty>No courses match &ldquo;{search}&rdquo;.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Audience</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Flags</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const busy = busyId === c.id;
                return (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{c.title}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {c.audience}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {c.price === 0 ? (
                        <span className="text-green-700 dark:text-green-400">
                          Free
                        </span>
                      ) : (
                        <span>£{c.price}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={c.status}
                        disabled={busy}
                        onChange={(e) =>
                          quickPatch(c.id, { status: e.target.value })
                        }
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wider ${
                          c.status === "AVAILABLE"
                            ? "border-green-200 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                            : c.status === "COMING_SOON"
                              ? "border-amber-200 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        <option value="AVAILABLE">LIVE</option>
                        <option value="COMING_SOON">SOON</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            quickPatch(c.id, { isFeatured: !c.isFeatured })
                          }
                          className={`rounded-full px-2 py-0.5 font-bold tracking-wider transition ${
                            c.isFeatured
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          {c.isFeatured ? "★ FEATURED" : "☆ FEATURE"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            quickPatch(c.id, {
                              isBestseller: !c.isBestseller,
                            })
                          }
                          className={`rounded-full px-2 py-0.5 font-bold tracking-wider transition ${
                            c.isBestseller
                              ? "bg-amber-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          {c.isBestseller ? "🔥 BEST" : "BEST"}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/training/${c.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
