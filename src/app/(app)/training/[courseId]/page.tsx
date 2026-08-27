"use client";

import { use, useEffect, useState } from "react";
import { ArrowLeft, Lock, Circle, CheckCircle2, XCircle, Award, Clock, Users, Play, Pencil } from "lucide-react";
import Link from "next/link";
import { richTextToPlain } from "@/lib/rich-text";

interface ModuleData {
  id: string;
  title: string;
  order: number;
  status: "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  score: number | null;
  attempts: number;
  completedAt: string | null;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  audience: string;
  duration: string;
  modules: ModuleData[];
  enrollmentId: string | null;
  enrollmentStatus: "IN_PROGRESS" | "COMPLETED" | null;
  completedAt: string | null;
}

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        setCourse(data);
        setLoading(false);
      });
  }, [courseId]);

  if (loading || !course) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const completedCount = course.modules.filter((m) => m.status === "COMPLETED").length;
  const progressPercent = course.modules.length > 0 ? Math.round((completedCount / course.modules.length) * 100) : 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case "LOCKED": return <Lock className="h-5 w-5 text-muted-foreground" />;
      case "IN_PROGRESS": return <Circle className="h-5 w-5 text-primary" />;
      case "COMPLETED": return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "FAILED": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Lock className="h-5 w-5 text-muted-foreground/60" />;
    }
  };

  const statusLabel = (mod: ModuleData) => {
    switch (mod.status) {
      case "LOCKED": return "Locked";
      case "IN_PROGRESS": return "Ready";
      case "COMPLETED": return `Passed (${mod.score}%)`;
      case "FAILED": return `Failed (${mod.score}%) — Tap to retry`;
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/training" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Training
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          <Link
            href={`/training/${courseId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-muted/50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit course content
          </Link>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.audience}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
          <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {course.modules.length} modules</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-2xl">{richTextToPlain(course.description ?? "")}</p>
      </div>

      {/* Overall Progress */}
      {course.enrollmentId && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{progressPercent}%</p>
            </div>
            {course.enrollmentStatus === "COMPLETED" && (
              <a
                href={`/api/training/certificate/${course.enrollmentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <Award className="h-4 w-4" />
                Download Certificate
              </a>
            )}
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completedCount} of {course.modules.length} modules completed
          </p>
        </div>
      )}

      {/* Module List */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Modules</h2>
        {course.modules.map((mod, i) => {
          const isClickable = mod.status !== "LOCKED";
          const inner = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{mod.title}</p>
                <p className="text-xs text-muted-foreground">{statusLabel(mod)}</p>
              </div>
              {statusIcon(mod.status)}
            </>
          );

          return isClickable ? (
            <Link
              key={mod.id}
              href={`/training/${courseId}/modules/${mod.id}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] card-lift cursor-pointer"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={mod.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] opacity-60 cursor-not-allowed"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
