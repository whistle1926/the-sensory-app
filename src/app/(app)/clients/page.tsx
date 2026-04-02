import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/dashboard");

  const { role, id: userId } = session.user;

  const where =
    role === "SUPER_ADMIN" ? {} : { managerId: userId };

  const clients = await prisma.client.findMany({
    where: { ...where, active: true },
    include: { _count: { select: { reports: true } } },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/clients/new" className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500">No clients yet. Add your first client to get started.</p>
            <Link href="/clients/new" className={cn(buttonVariants(), "mt-4")}>Add Client</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {client.firstName} {client.lastName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-500">
                    DOB: {new Date(client.dateOfBirth).toLocaleDateString("en-GB")}
                  </p>
                  {client.diagnosis && (
                    <p className="text-sm text-gray-500">
                      {client.diagnosis}
                    </p>
                  )}
                  <Badge variant="secondary">
                    {client._count.reports} report{client._count.reports !== 1 ? "s" : ""}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
