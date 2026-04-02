"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Users, Plus } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  clientCount: number;
  reportCount: number;
  recentReports: { id: string; reportDate: string; client: { firstName: string; lastName: string } }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({ clientCount: 0, reportCount: 0, recentReports: [] });

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Link href="/reports/new" className={buttonVariants({ className: "rounded-xl bg-[oklch(0.637_0.237_25.331)] hover:bg-[oklch(0.57_0.237_25.331)]" })}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">Active Clients</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[oklch(0.955_0.015_25)]">
              <Users className="h-4 w-4 text-[oklch(0.637_0.237_25.331)]" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight">{data.clientCount}</p>
        </div>

        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">Total Reports</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[oklch(0.955_0.015_25)]">
              <FileText className="h-4 w-4 text-[oklch(0.637_0.237_25.331)]" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight">{data.reportCount}</p>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">Recent Reports</h2>
        <div className="mt-3 space-y-3">
          {data.recentReports.length === 0 ? (
            <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-10 text-center shadow-sm">
              <p className="text-sm text-[oklch(0.5_0.01_260)]">No reports yet. Add a client and generate your first report.</p>
            </div>
          ) : (
            data.recentReports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`}>
                <div className="group rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-4 shadow-sm transition-all hover:border-[oklch(0.637_0.237_25.331)]/30 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[oklch(0.17_0.015_280)]">{r.client.firstName} {r.client.lastName}</p>
                      <p className="mt-0.5 text-sm text-[oklch(0.5_0.01_260)]">
                        {new Date(r.reportDate).toLocaleDateString()}
                      </p>
                    </div>
                    <FileText className="h-5 w-5 text-[oklch(0.637_0.237_25.331)] opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
