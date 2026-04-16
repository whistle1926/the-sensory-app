import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FileText, Users, Plus } from "lucide-react";
import Link from "next/link";
import { NewClientsSection } from "@/components/dashboard/new-clients-section";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // ── Resolve which widgets this user should see ──────
  let visibleWidgets: string[] | null = null;

  if (userId) {
    const [user, defaultTemplate] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { dashTemplate: { select: { widgets: true } } },
      }),
      prisma.dashTemplate.findFirst({
        where: { isDefault: true },
        select: { widgets: true },
      }),
    ]);

    const template = user?.dashTemplate || defaultTemplate;
    if (template) visibleWidgets = template.widgets;
  }

  const show = (key: string) =>
    visibleWidgets === null || visibleWidgets.includes(key);

  // ── Awaiting stage (for new_clients widget) ──────
  const awaitingStage = show("new_clients")
    ? await prisma.clientStage.findFirst({
        where: { isDefault: true },
        select: { id: true },
      })
    : null;

  // ── Parallel data fetches — skip queries for hidden widgets ─
  const [clientCount, reportCount, recentReports, newClients] =
    await Promise.all([
      show("stat_active_clients")
        ? prisma.client.count({ where: { active: true } })
        : 0,
      show("stat_total_reports")
        ? prisma.report.count()
        : 0,
      show("recent_reports")
        ? prisma.report.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { client: { select: { firstName: true, lastName: true } } },
          })
        : [],
      show("new_clients") && awaitingStage
        ? prisma.client.findMany({
            where: { stageId: awaitingStage.id, active: true },
            orderBy: { createdAt: "desc" },
            include: {
              intakeItems: { orderBy: { createdAt: "asc" } },
              stage: { select: { id: true, label: true, colour: true } },
            },
          })
        : [],
    ]);

  const hasStatCards = show("stat_active_clients") || show("stat_total_reports");

  // Serialize dates for client components
  const serializedNewClients = newClients.map((c) => ({
    ...c,
    dateOfBirth: c.dateOfBirth.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    intakeItems: c.intakeItems.map((item) => ({
      ...item,
      sentAt: item.sentAt?.toISOString() ?? null,
      completedAt: item.completedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of your clients and reports</p>
        </div>
        <Link
          href="/reports/new"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground shadow-[var(--shadow-xs)] hover:brightness-110 transition-all"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Link>
      </div>

      {hasStatCards && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {show("stat_active_clients") && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] card-lift">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                  <Users className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{clientCount}</p>
            </div>
          )}

          {show("stat_total_reports") && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] card-lift">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                  <FileText className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{reportCount}</p>
            </div>
          )}
        </div>
      )}

      {show("new_clients") && (
        <NewClientsSection clients={serializedNewClients} />
      )}

      {show("recent_reports") && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Reports</h2>
          <div className="mt-3 space-y-3">
            {recentReports.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
                <p className="text-sm text-muted-foreground">No reports yet. Add a client and generate your first report.</p>
              </div>
            ) : (
              recentReports.map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`}>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] card-lift">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{r.client.firstName} {r.client.lastName}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {new Date(r.reportDate).toLocaleDateString()}
                        </p>
                      </div>
                      <FileText className="h-5 w-5 text-primary opacity-50" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
