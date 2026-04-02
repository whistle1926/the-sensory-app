import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id: userId } = session.user;

  const where =
    role === "SUPER_ADMIN"
      ? {}
      : role === "TEAM_MANAGER"
        ? { client: { managerId: userId } }
        : { client: { parentId: userId } };

  const reports = await prisma.report.findMany({
    where,
    include: { client: true, author: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        {role !== "CLIENT" && (
          <Link href="/reports/new" className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />
              New Report
          </Link>
        )}
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500">No reports yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">
                      {report.client.firstName} {report.client.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(report.reportDate).toLocaleDateString("en-GB")}
                      {" - "}
                      {report.author.name}
                    </p>
                  </div>
                  <Badge variant={report.status === "final" ? "default" : "secondary"}>
                    {report.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
