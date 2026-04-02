import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Users, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id: userId } = session.user;

  const clientWhere =
    role === "SUPER_ADMIN"
      ? {}
      : role === "TEAM_MANAGER"
        ? { managerId: userId }
        : { parentId: userId };

  const [clientCount, reportCount, recentReports] = await Promise.all([
    prisma.client.count({ where: { ...clientWhere, active: true } }),
    prisma.report.count({
      where: role === "CLIENT" ? { client: { parentId: userId } } : role === "TEAM_MANAGER" ? { client: { managerId: userId } } : {},
    }),
    prisma.report.findMany({
      where: role === "CLIENT" ? { client: { parentId: userId } } : role === "TEAM_MANAGER" ? { client: { managerId: userId } } : {},
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {role !== "CLIENT" && (
          <Link href="/reports/new" className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />
              New Report
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {role === "CLIENT" ? "My Children" : "Active Clients"}
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{clientCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Reports
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{reportCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <p className="text-sm text-gray-500">No reports yet.</p>
          ) : (
            <div className="space-y-3">
              {recentReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">
                      {report.client.firstName} {report.client.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(report.reportDate).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      report.status === "final"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {report.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
