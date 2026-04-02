import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Users, Plus } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const [clientCount, reportCount, recentReports] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.report.count(),
    prisma.report.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { client: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/reports/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Clients
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
            <p className="text-sm text-gray-500">No reports yet. Add a client and generate your first report.</p>
          ) : (
            <ul className="space-y-2">
              {recentReports.map((r) => (
                <li key={r.id}>
                  <Link href={`/reports/${r.id}`} className="text-sm text-blue-600 hover:underline">
                    {r.client.firstName} {r.client.lastName} — {new Date(r.reportDate).toLocaleDateString()}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
