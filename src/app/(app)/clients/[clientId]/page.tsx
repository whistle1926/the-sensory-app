import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { canAccessClient } from "@/lib/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, CheckCircle2, AlertCircle, GraduationCap } from "lucide-react";
import Link from "next/link";
import { ClientProfileEditor } from "@/components/clients/client-profile-editor";
import { ViewAsButton } from "@/components/impersonate/view-as-button";
import { ProgressNotesSection } from "@/components/clients/progress-notes-section";
import { GoalsSection } from "@/components/clients/goals-section";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      reports: {
        include: { session: true },
        orderBy: { reportDate: "desc" },
      },
      parent: {
        include: {
          setupTokens: {
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          enrollments: {
            include: {
              course: { select: { id: true, title: true } },
              moduleProgress: { select: { status: true } },
            },
            orderBy: { enrolledAt: "desc" },
          },
        },
      },
    },
  });

  if (!client) notFound();
  if (!canAccessClient(session.user.role, session.user.id, client)) redirect("/dashboard");

  const adminCanEdit = session.user.role !== "CLIENT";
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const parent = client.parent;
  const hasPendingSetup = !!parent && parent.setupTokens.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-muted-foreground">
            DOB: {new Date(client.dateOfBirth).toLocaleDateString("en-GB")}
          </p>
        </div>
        {adminCanEdit && (
          <Link
            href={`/reports/new?clientId=${client.id}`}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium h-8 gap-1.5 px-2.5 hover:bg-primary/80 transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {adminCanEdit ? (
          <ClientProfileEditor
            client={{
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              dateOfBirth: client.dateOfBirth.toISOString().slice(0, 10),
              diagnosis: client.diagnosis || "",
              presentingConcerns: client.presentingConcerns || "",
              referrer: client.referrer || "",
              parentCarerName: client.parentCarerName || "",
              parentCarerEmail: client.parentCarerEmail || "",
            }}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.diagnosis && (
                <div>
                  <span className="font-medium">Diagnosis:</span> {client.diagnosis}
                </div>
              )}
              {client.presentingConcerns && (
                <div>
                  <span className="font-medium">Presenting Concerns:</span> {client.presentingConcerns}
                </div>
              )}
              {client.referrer && (
                <div>
                  <span className="font-medium">Referrer:</span> {client.referrer}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {adminCanEdit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parent account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {parent ? (
                <>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Name:</span> {parent.name}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span>{" "}
                      <a href={`mailto:${parent.email}`} className="text-primary hover:underline">
                        {parent.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPendingSetup ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span className="text-amber-700 dark:text-amber-400">
                            Password setup link pending
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-green-700 dark:text-green-400">Password set · can log in</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className="border-t border-border pt-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Preview what the parent sees when they log in.
                      </p>
                      <ViewAsButton
                        targetUserId={parent.id}
                        targetLabel={parent.name.split(" ")[0] || "parent"}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">No parent account linked</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add a Parent/Carer email in the client details above to create a linked account automatically.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {adminCanEdit && parent && parent.enrollments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-primary" />
              Training
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parent.enrollments.map((enrol) => {
              const total = enrol.moduleProgress.length;
              const done = enrol.moduleProgress.filter(
                (p) => p.status === "COMPLETED"
              ).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isComplete = enrol.status === "COMPLETED";
              const enrolledOn = new Date(enrol.enrolledAt).toLocaleDateString("en-GB");
              return (
                <div
                  key={enrol.id}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {enrol.course.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Enrolled {enrolledOn}
                        {" · "}
                        {done} of {total} modules complete
                      </p>
                    </div>
                    <Badge variant={isComplete ? "default" : "secondary"}>
                      {isComplete ? "Completed" : "In progress"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                  {isSuperAdmin && (
                    <div className="mt-3">
                      <ViewAsButton
                        targetUserId={parent.id}
                        targetLabel={parent.name.split(" ")[0] || "parent"}
                        returnPath={`/portal/training/${enrol.course.id}`}
                        label="Open this course as parent"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {client.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <div className="space-y-3">
              {client.reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground/60" />
                    <div>
                      <p className="font-medium">Session {report.session.sessionNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(report.reportDate).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={report.status === "final" ? "default" : "secondary"}>
                    {report.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProgressNotesSection clientId={client.id} />

      <GoalsSection clientId={client.id} isAdmin={adminCanEdit} />
    </div>
  );
}
