import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { canAccessClient } from "@/lib/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";

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
    },
  });

  if (!client) notFound();
  if (!canAccessClient(session.user.role, session.user.id, client)) redirect("/dashboard");

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
        {session.user.role !== "CLIENT" && (
          <Link href={`/reports/new?clientId=${client.id}`} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium h-8 gap-1.5 px-2.5 hover:bg-primary/80 transition-colors">
              <Plus className="mr-2 h-4 w-4" />
              New Report
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            {client.parentCarerName && (
              <div>
                <span className="font-medium">Parent/Carer:</span> {client.parentCarerName}
              </div>
            )}
          </CardContent>
        </Card>
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
                      <p className="font-medium">
                        Session {report.session.sessionNumber}
                      </p>
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
