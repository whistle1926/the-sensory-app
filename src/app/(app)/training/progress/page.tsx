"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";

interface ProgressEntry {
  id: string;
  user: { id: string; name: string; email: string };
  course: { id: string; title: string };
  status: "IN_PROGRESS" | "COMPLETED";
  enrolledAt: string;
  completedAt: string | null;
  totalModules: number;
  completedModules: number;
  progressPercent: number;
}

export default function TrainingProgressPage() {
  const [data, setData] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetch("/api/training/progress")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const courses = [...new Set(data.map((e) => e.course.title))];
  const filtered = data.filter((e) => {
    if (filterCourse !== "all" && e.course.title !== filterCourse) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/training" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Training
        </Link>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Learner Progress</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Track all learner enrollments and course completion
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All Courses</option>
          {courses.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Stats summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Total Enrollments</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{data.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Completed</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-green-600">
            {data.filter((e) => e.status === "COMPLETED").length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">In Progress</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-blue-600">
            {data.filter((e) => e.status === "IN_PROGRESS").length}
          </p>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">No enrollments found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Learner</th>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Course</th>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Progress</th>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Enrolled</th>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Completed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{e.user.name}</p>
                      <p className="text-xs text-muted-foreground">{e.user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-foreground/80">{e.course.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${e.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{e.progressPercent}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.completedModules}/{e.totalModules} modules</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        e.status === "COMPLETED"
                          ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                      }`}>
                        {e.status === "COMPLETED" ? "Completed" : "In Progress"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(e.enrolledAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {e.completedAt ? new Date(e.completedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
