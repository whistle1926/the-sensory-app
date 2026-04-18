import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookOpen, Clock, GraduationCap, Play, Users } from "lucide-react";
import { TrainingCatalogue } from "@/components/training/training-catalogue";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

export const dynamic = "force-dynamic";

/**
 * Portal — training list. Parent-facing catalogue of available courses
 * plus progress bars for anything they've started.
 */
export default async function PortalTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/dashboard");

  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    include: {
      modules: { select: { id: true }, orderBy: { order: "asc" } },
      enrollments: {
        where: { userId: session.user.id },
        include: { moduleProgress: { select: { status: true } } },
      },
    },
  });

  const cards = courses.map((course) => {
    const enrollment = course.enrollments[0] ?? null;
    const totalModules = course.modules.length;
    const completedModules = enrollment
      ? enrollment.moduleProgress.filter(
          (mp) => mp.status === "COMPLETED",
        ).length
      : 0;
    return {
      id: course.id,
      title: course.title,
      audience: course.audience,
      duration: course.duration,
      description: course.description,
      status: course.status as "AVAILABLE" | "COMING_SOON" | "ARCHIVED",
      price: course.price,
      totalModules,
      enrollmentId: enrollment?.id ?? null,
      enrollmentStatus: (enrollment?.status ?? null) as
        | "IN_PROGRESS"
        | "COMPLETED"
        | null,
      completedModules,
      progressPercent:
        totalModules > 0
          ? Math.round((completedModules / totalModules) * 100)
          : 0,
    };
  });

  const available = cards.filter((c) => c.status === "AVAILABLE");
  const comingSoon = cards.filter((c) => c.status === "COMING_SOON");
  const enrolled = available.filter((c) => c.enrollmentStatus);

  return (
    <div className="space-y-6">
      <Toolbar
        title="Training"
        subtitle="Online courses and CPD training. Start any available course — your progress is saved as you go."
      />

      {enrolled.length > 0 && (
        <Panel
          title="Continue learning"
          subtitle={`${enrolled.length} active enrolment${enrolled.length === 1 ? "" : "s"}`}
        >
          <div className="divide-y divide-border">
            {enrolled.map((course) => (
              <div key={course.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{course.title}</h3>
                      {course.enrollmentStatus === "COMPLETED" && (
                        <Chip tone="success">Completed</Chip>
                      )}
                      {course.enrollmentStatus === "IN_PROGRESS" && (
                        <Chip tone="info">In progress</Chip>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {course.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" /> {course.completedModules}/
                        {course.totalModules} modules
                      </span>
                    </div>
                  </div>
                  {course.enrollmentStatus === "COMPLETED" ? (
                    <Link
                      href={`/portal/training/${course.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      <BookOpen className="h-4 w-4" /> Review
                    </Link>
                  ) : (
                    <Link
                      href={`/portal/training/${course.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                    >
                      <Play className="h-4 w-4" /> Continue
                    </Link>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground ds-tabular">
                    {course.progressPercent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="Available courses"
        subtitle={`${available.length} course${available.length === 1 ? "" : "s"} open for enrolment`}
        padded
      >
        <TrainingCatalogue courses={available} />
      </Panel>

      {comingSoon.length > 0 && (
        <Panel title="Coming soon" subtitle="Not yet available">
          <div className="divide-y divide-border">
            {comingSoon.map((course) => (
              <div key={course.id} className="px-5 py-4 opacity-80">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{course.title}</h3>
                  <Chip tone="warn">Coming soon</Chip>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
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

      {available.length === 0 && comingSoon.length === 0 && (
        <Panel>
          <div className="ds-empty">
            <GraduationCap
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No courses yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Check back soon — new courses will land here.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
