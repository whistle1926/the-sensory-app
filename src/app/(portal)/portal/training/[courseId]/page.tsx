import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  Play,
  Users,
  XCircle,
} from "lucide-react";
import { Toolbar, Panel } from "@/components/ds";

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
      return score != null
        ? `Failed (${score}%) — Tap to retry`
        : "Failed — Tap to retry";
  }
}

/**
 * Portal — course landing. Shows overall progress, certificate button when
 * complete, and the full module list.
 */
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
      modules: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, order: true },
      },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: {
            select: {
              moduleId: true,
              status: true,
              score: true,
              attempts: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  if (!course) notFound();
  const enrollment = course.enrollments[0] ?? null;
  if (!enrollment) redirect("/portal/training");

  const progressMap = new Map(
    enrollment.moduleProgress.map((mp) => [mp.moduleId, mp]),
  );
  const modules = course.modules.map((mod) => {
    const p = progressMap.get(mod.id);
    return {
      ...mod,
      status: (p?.status ?? "LOCKED") as ModuleStatus,
      score: p?.score ?? null,
      attempts: p?.attempts ?? 0,
    };
  });

  const completedCount = modules.filter(
    (m) => m.status === "COMPLETED",
  ).length;
  const progressPercent =
    modules.length > 0
      ? Math.round((completedCount / modules.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/training"
        className="ds-link inline-flex items-center"
        style={{ fontWeight: 500 }}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Back to training
      </Link>

      <Toolbar
        title={course.title}
        subtitle={
          <span className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {course.audience}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {course.duration}
            </span>
            <span className="inline-flex items-center gap-1">
              <Play className="h-3 w-3" /> {modules.length} modules
            </span>
          </span>
        }
        actions={
          enrollment.status === "COMPLETED" && (
            <a
              href={`/api/training/certificate/${enrollment.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <Award className="h-4 w-4" /> Download Certificate
            </a>
          )
        }
      />

      {course.description && (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {course.description}
        </p>
      )}

      {/* Progress KPI */}
      <div className="ds-kpi accent">
        <div className="ds-kpi-head">
          <span className="ds-kpi-label">Overall progress</span>
          <span className="ds-kpi-icon">
            <Award className="h-4 w-4" />
          </span>
        </div>
        <span className="ds-kpi-value ds-tabular">{progressPercent}%</span>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="ds-kpi-foot">
          <span>
            {completedCount} of {modules.length} modules completed
          </span>
        </div>
      </div>

      {/* Module list */}
      <Panel
        title="Modules"
        subtitle={`${modules.length} module${modules.length === 1 ? "" : "s"} — unlocks as you complete each one`}
      >
        <div className="divide-y divide-border">
          {modules.map((mod, i) => {
            const clickable = mod.status !== "LOCKED";
            const body = (
              <>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <span className="text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{mod.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(mod.status, mod.score)}
                  </p>
                </div>
                {statusIcon(mod.status)}
              </>
            );
            return clickable ? (
              <Link
                key={mod.id}
                href={`/portal/training/${courseId}/${mod.id}`}
                className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/20"
              >
                {body}
              </Link>
            ) : (
              <div
                key={mod.id}
                className="flex cursor-not-allowed items-center gap-4 px-5 py-4 opacity-60"
              >
                {body}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
