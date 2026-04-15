import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { canAccessClient } from "@/lib/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { ClientProfileEditor } from "@/components/clients/client-profile-editor";
import { ViewAsButton } from "@/components/impersonate/view-as-button";

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
              <CardTitle className="text-base">Parent Account</CardTitle>
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
    </div>
  );
}
