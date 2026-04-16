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
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { dashTemplate: { select: { widgets: true } } },
      });

      if (user?.dashTemplate) {
        visibleWidgets = user.dashTemplate.widgets;
      } else {
        // Fall back to the default template if the user has no explicit assignment
        const defaultTemplate = await prisma.dashTemplate.findFirst({
          where: { isDefault: true },
          select: { widgets: true },
        });
        if (defaultTemplate) {
          visibleWidgets = defaultTemplate.widgets;
        }
      }
    }

    // Helper: only fetch data for a widget if it's visible (or if there's no template at all)
    const show = (key: string) => visibleWidgets === null || visibleWidgets.includes(key);

    // ── Awaiting stage (needed for new_clients widget) ──────────
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
          : Promise.resolve(0),
        show("stat_total_reports")
          ? prisma.report.count()
          : Promise.resolve(0),
        show("recent_reports")
          ? prisma.report.findMany({
              take: 5,
              orderBy: { createdAt: "desc" },
              include: { client: { select: { firstName: true, lastName: true } } },
            })
          : Promise.resolve([]),
        show("new_clients") && awaitingStage
          ? prisma.client.findMany({
              where: { stageId: awaitingStage.id, active: true },
              orderBy: { createdAt: "desc" },
              include: {
                intakeItems: { orderBy: { createdAt: "asc" } },
                stage: { select: { id: true, label: true, colour: true } },
              },
            })
          : Promise.resolve([]),
      ]);

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
