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
        <Link href="/reports/new" className={buttonVariants({ className: "rounded-xl bg-[oklch(0.637_0.237_25.331)] hover:bg-[oklch(0.57_0.237_25.331)]" })}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-10 text-center shadow-sm">
          <p className="text-[oklch(0.5_0.01_260)]">No reports yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <div className="group rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-4 shadow-sm transition-all hover:border-[oklch(0.637_0.237_25.331)]/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[oklch(0.17_0.015_280)]">{r.client.firstName} {r.client.lastName}</p>
                    <p className="mt-0.5 text-sm text-[oklch(0.5_0.01_260)]">
                      {new Date(r.reportDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.status === "final"
                      ? "bg-green-50 text-green-700"
                      : "bg-[oklch(0.955_0.015_25)] text-[oklch(0.637_0.237_25.331)]"
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
