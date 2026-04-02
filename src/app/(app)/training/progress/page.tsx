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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[oklch(0.637_0.237_25.331)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/training" className="inline-flex items-center gap-1 text-sm text-[oklch(0.5_0.01_260)] hover:text-[oklch(0.637_0.237_25.331)] transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Training
        </Link>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-[oklch(0.637_0.237_25.331)]" />
          <h1 className="text-2xl font-bold tracking-tight">Learner Progress</h1>
        </div>
        <p className="mt-1 text-sm text-[oklch(0.5_0.01_260)]">
          Track all learner enrollments and course completion
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          className="rounded-xl border border-[oklch(0.915_0.005_260)] bg-white px-3 py-2 text-sm"
        >
          <option value="all">All Courses</option>
          {courses.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[oklch(0.915_0.005_260)] bg-white px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Stats summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">Total Enrollments</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{data.length}</p>
        </div>
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">Completed</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-green-600">
            {data.filter((e) => e.status === "COMPLETED").length}
          </p>
        </div>
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">In Progress</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-blue-600">
            {data.filter((e) => e.status === "IN_PROGRESS").length}
          </p>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-[oklch(0.5_0.01_260)]">No enrollments found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[oklch(0.915_0.005_260)] bg-[oklch(0.975_0.002_260)]">
                  <th className="px-5 py-3 text-left font-semibold text-[oklch(0.5_0.01_260)]">Learner</th>
                  <th className="px-5 py-3 text-left font-semibold text-[oklch(0.5_0.01_260)]">Course</th>
                  <th className="px-5 py-3 text-left font-semibold text-[oklch(0.5_0.01_260)]">Progress</th>
                  <th className="px-5 py-3 text-left font-semibold text-[oklch(0.5_0.01_260)]">Status</th>
                  <th className="px-5 py-3 text-left font-semibold text-[oklch(0.5_0.01_260)]">Enrolled</th>
                  <th className="px-5 py-3 text-left font-semibold text-[oklch(0.5_0.01_260)]">Completed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-[oklch(0.955_0.005_260)] last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[oklch(0.17_0.015_280)]">{e.user.name}</p>
                      <p className="text-xs text-[oklch(0.5_0.01_260)]">{e.user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-[oklch(0.35_0.01_280)]">{e.course.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-[oklch(0.915_0.005_260)]">
                          <div
                            className="h-full rounded-full bg-[oklch(0.637_0.237_25.331)]"
                            style={{ width: `${e.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[oklch(0.5_0.01_260)]">{e.progressPercent}%</span>
                      </div>
                      <p className="text-xs text-[oklch(0.5_0.01_260)]">{e.completedModules}/{e.totalModules} modules</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        e.status === "COMPLETED"
                          ? "bg-green-50 text-green-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {e.status === "COMPLETED" ? "Completed" : "In Progress"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[oklch(0.5_0.01_260)]">
                      {new Date(e.enrolledAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-xs text-[oklch(0.5_0.01_260)]">
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
