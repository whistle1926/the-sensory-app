"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReportViewer } from "@/components/reports/report-viewer";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportContent } from "@/types/report";
import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar, Chip, Panel } from "@/components/ds";

interface ReportData {
  id: string;
  status: string;
  content: ReportContent;
  client: {
    firstName: string;
    lastName: string;
    parentCarerEmail?: string;
  };
  reportDate: string;
}

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data: session } = useSession();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin =
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "TEAM_MANAGER";

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, [reportId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <Panel>
        <p className="p-10 text-center text-sm text-muted-foreground">
          Report not found.
        </p>
      </Panel>
    );
  }

  const status = (report.status || "draft").toLowerCase();
  const tone = status === "final" ? "success" : "warn";

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link
          href="/reports"
          className="ds-link inline-flex items-center"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to reports
        </Link>
      </div>

      <div className="print:hidden">
        <Toolbar
          title={`${report.client.firstName} ${report.client.lastName}`}
          subtitle={`Report dated ${new Date(report.reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
          actions={
            <div className="flex items-center gap-3">
              <Chip tone={tone}>
                {status[0].toUpperCase() + status.slice(1)}
              </Chip>
              <ReportActions
                reportId={report.id}
                status={report.status}
                onStatusChange={(s) => setReport({ ...report, status: s })}
                showEmail={isAdmin}
              />
            </div>
          }
        />
      </div>

      <ReportViewer content={report.content} />
    </div>
  );
}
