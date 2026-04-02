"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link href="/reports/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500">No reports yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <Card className="hover:border-gray-300 transition-colors">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{r.client.firstName} {r.client.lastName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(r.reportDate).toLocaleDateString()} — {r.status}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
