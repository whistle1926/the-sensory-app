import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link href="/reports/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-gray-500">No reports yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
