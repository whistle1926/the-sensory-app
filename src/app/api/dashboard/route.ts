import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Find the "new / awaiting" stage (order 0 or isDefault) for the new-clients section.
    const awaitingStage = await prisma.clientStage.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });

    const [clientCount, reportCount, recentReports, newClients] =
      await Promise.all([
        prisma.client.count({ where: { active: true } }),
        prisma.report.count(),
        prisma.report.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { client: { select: { firstName: true, lastName: true } } },
        }),
        awaitingStage
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
      clientCount,
      reportCount,
      recentReports,
      newClients,
    });
  } catch (error: unknown) {
    console.error("[DASHBOARD API]", error);
    return NextResponse.json({
      clientCount: 0,
      reportCount: 0,
      recentReports: [],
      newClients: [],
    });
  }
}
