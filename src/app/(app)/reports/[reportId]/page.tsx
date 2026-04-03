"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ReportViewer } from "@/components/reports/report-viewer";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportContent } from "@/types/report";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface ReportData {
  id: string;
  status: string;
  content: ReportContent;
  client: { firstName: string; lastName: string };
  reportDate: string;
}

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <p>Report not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="text-sm text-muted-foreground hover:text-muted-foreground">
            Reports
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-lg font-semibold">
            {report.client.firstName} {report.client.lastName}
          </h1>
          <Badge variant={report.status === "final" ? "default" : "secondary"}>
            {report.status}
          </Badge>
        </div>
        <ReportActions
          reportId={report.id}
          status={report.status}
          onStatusChange={(s) => setReport({ ...report, status: s })}
        />
      </div>

      <ReportViewer content={report.content} />
    </div>
  );
}
