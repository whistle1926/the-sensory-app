import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Clock, Users, Play, BookOpen } from "lucide-react";
import { TrainingCatalogue } from "@/components/training/training-catalogue";

export const dynamic = "force-dynamic";

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
      ? enrollment.moduleProgress.filter((mp) => mp.status === "COMPLETED").length
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
      enrollmentStatus: (enrollment?.status ?? null) as "IN_PROGRESS" | "COMPLETED" | null,
      completedModules,
      progressPercent: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
    };
  });

  const available = cards.filter((c) => c.status === "AVAILABLE");
  const comingSoon = cards.filter((c) => c.status === "COMING_SOON");
  const enrolled = available.filter((c) => c.enrollmentStatus);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Online courses and CPD training. Start any available course &mdash; your progress is saved as you go.
        </p>
      </div>

      {enrolled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Continue learning
          </h2>
          <div className="space-y-3">
            {enrolled.map((course) => (
              <Card key={course.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{course.title}</h3>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {course.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" /> {course.completedModules}/{course.totalModules} modules
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
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available courses
        </h2>
        <TrainingCatalogue courses={available} />
      </section>

      {comingSoon.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coming soon
          </h2>
          <div className="space-y-3">
            {comingSoon.map((course) => (
              <Card key={course.id} className="opacity-70">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                      Coming soon
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {course.audience}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {course.duration}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {course.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {available.length === 0 && comingSoon.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No courses available yet. Check back soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
