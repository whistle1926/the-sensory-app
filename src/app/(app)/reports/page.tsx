"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Report {
  id: string;
  reportDate: string;
  status: string;
  client: { firstName: string; lastName: string };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    fetch("/api/reports").then(r => r.json()).then(data => {
      setReports(Array.isArray(data) ? data : []);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <Link href="/reports/new" className={buttonVariants({ className: "rounded-xl" })}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
          <p className="text-muted-foreground">No reports yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] card-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{r.client.firstName} {r.client.lastName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(r.reportDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.status === "final"
                      ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                      : "bg-secondary text-primary"
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
