import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/clients/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Link>
      </div>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-gray-500">No clients yet. Add your first client to get started.</p>
          <Link href="/clients/new" className={cn(buttonVariants(), "mt-4")}>Add Client</Link>
        </CardContent>
      </Card>
    </div>
  );
}
