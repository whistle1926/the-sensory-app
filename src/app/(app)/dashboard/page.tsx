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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of your clients and reports</p>
        </div>
        <Link href="/reports/new" className={buttonVariants({ className: "rounded-xl" })}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] card-lift">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight">{data.clientCount}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] card-lift">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
              <FileText className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight">{data.reportCount}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Reports</h2>
        <div className="mt-3 space-y-3">
          {data.recentReports.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
              <p className="text-sm text-muted-foreground">No reports yet. Add a client and generate your first report.</p>
            </div>
          ) : (
            data.recentReports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`}>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] card-lift">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{r.client.firstName} {r.client.lastName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {new Date(r.reportDate).toLocaleDateString()}
                      </p>
                    </div>
                    <FileText className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
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
