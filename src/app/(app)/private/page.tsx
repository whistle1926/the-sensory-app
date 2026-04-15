import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/private-pin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivateDashboard } from "@/components/private/private-dashboard";

export const dynamic = "force-dynamic";

export default async function PrivateHomePage() {
  if (!(await isUnlocked())) redirect("/private/unlock");

  // Ensure the singleton config row exists.
  const config = await prisma.privateConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", incomeGoal: 250000 },
  });

  const [totalAgg, entries] = await Promise.all([
    prisma.incomeEntry.aggregate({ _sum: { amount: true } }),
    prisma.incomeEntry.findMany({
      orderBy: { occurredAt: "desc" },
      take: 50,
    }),
  ]);

  const total = totalAgg._sum.amount || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Private</h1>
          <p className="text-sm text-muted-foreground">Income tracker · SUPER_ADMIN only</p>
        </div>
      </div>

      <PrivateDashboard
        initialGoal={config.incomeGoal}
        initialTotal={total}
        initialEntries={entries.map((e) => ({
          id: e.id,
          amount: e.amount,
          source: e.source,
          description: e.description,
          reference: e.reference,
          occurredAt: e.occurredAt.toISOString(),
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Paid bookings credit this total automatically. Add manual entries for other income (courses, cash, partnerships).</p>
          <p>Your PIN unlocks this area for 2 hours. Tap &ldquo;Lock&rdquo; to end the session sooner.</p>
        </CardContent>
      </Card>
    </div>
  );
}
