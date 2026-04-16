import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // ── Resolve which widgets this user should see ──────────────
    let visibleWidgets: string[] | null = null; // null = show everything (no template)

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

    // Helper: only fetch data for a widget if it's visible (or if there's no template at all)
    const show = (key: string) => visibleWidgets === null || visibleWidgets.includes(key);

    // ── Parallel data fetches — skip queries for hidden widgets ─
    // Fetch awaiting stage alongside counts for maximum parallelism
    const [clientCount, reportCount, recentReports, awaitingStage] =
      await Promise.all([
        show("stat_active_clients")
          ? prisma.client.count({ where: { active: true } })
          : Promise.resolve(0),
        show("stat_total_reports")
          ? prisma.report.count()
          : Promise.resolve(0),
        show("recent_reports")
          ? prisma.report.findMany({
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                reportDate: true,
                client: { select: { firstName: true, lastName: true } },
              },
            })
          : Promise.resolve([]),
        show("new_clients")
          ? prisma.clientStage.findFirst({
              where: { isDefault: true },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

    // ── New clients query (depends on awaitingStage result) ─────
    const newClients = show("new_clients") && awaitingStage
      ? await prisma.client.findMany({
          where: { stageId: awaitingStage.id, active: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            parentCarerName: true,
            parentCarerEmail: true,
            stage: { select: { id: true, label: true, colour: true } },
            intakeItems: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                type: true,
                label: true,
                url: true,
                status: true,
                sentAt: true,
                completedAt: true,
                notes: true,
                fileUrl: true,
                createdAt: true,
              },
            },
          },
        })
      : [];

    return NextResponse.json({
      visibleWidgets, // null means "show all"
      clientCount,
      reportCount,
      recentReports,
      newClients,
    });
  } catch (error: unknown) {
    console.error("[DASHBOARD API]", error);
    return NextResponse.json({
      visibleWidgets: null,
      clientCount: 0,
      reportCount: 0,
      recentReports: [],
      newClients: [],
    });
  }
}
