import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock, Circle, CheckCircle2, XCircle, Award, Clock, Users, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ModuleStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

function statusIcon(status: ModuleStatus) {
  switch (status) {
    case "LOCKED":
      return <Lock className="h-5 w-5 text-muted-foreground" />;
    case "IN_PROGRESS":
      return <Circle className="h-5 w-5 text-primary" />;
    case "COMPLETED":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "FAILED":
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function statusLabel(status: ModuleStatus, score: number | null): string {
  switch (status) {
    case "LOCKED":
      return "Locked";
    case "IN_PROGRESS":
      return "Ready";
    case "COMPLETED":
      return score != null ? `Passed (${score}%)` : "Passed";
    case "FAILED":
      return score != null ? `Failed (${score}%) — Tap to retry` : "Failed — Tap to retry";
  }
}

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
      modules: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true } },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: {
            select: { moduleId: true, status: true, score: true, attempts: true, completedAt: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const enrollment = course.enrollments[0] ?? null;

  // Not enrolled → back to catalogue so they can Start/Buy.
  if (!enrollment) redirect("/portal/training");

  const progressMap = new Map(enrollment.moduleProgress.map((mp) => [mp.moduleId, mp]));
  const modules = course.modules.map((mod) => {
    const p = progressMap.get(mod.id);
    return {
      ...mod,
      status: (p?.status ?? "LOCKED") as ModuleStatus,
      score: p?.score ?? null,
      attempts: p?.attempts ?? 0,
    };
  });

  const completedCount = modules.filter((m) => m.status === "COMPLETED").length;
  const progressPercent = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/training"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Training
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {course.audience}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <Play className="h-3 w-3" /> {modules.length} modules
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{course.description}</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall progress</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{progressPercent}%</p>
            </div>
            {enrollment.status === "COMPLETED" && (
              <a
                href={`/api/training/certificate/${enrollment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <Award className="h-4 w-4" /> Download Certificate
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
            {completedCount} of {modules.length} modules completed
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Modules</h2>
        {modules.map((mod, i) => {
          const clickable = mod.status !== "LOCKED";
          const body = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{mod.title}</p>
                <p className="text-xs text-muted-foreground">{statusLabel(mod.status, mod.score)}</p>
              </div>
              {statusIcon(mod.status)}
            </>
          );
          return clickable ? (
            <Link
              key={mod.id}
              href={`/portal/training/${courseId}/${mod.id}`}
              className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] transition-all hover:border-primary/40 hover:shadow-[var(--shadow-md)]"
            >
              {body}
            </Link>
          ) : (
            <div
              key={mod.id}
              className="flex cursor-not-allowed items-center gap-4 rounded-2xl border border-border bg-card p-4 opacity-60 shadow-[var(--shadow-sm)]"
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
