import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [clientCount, reportCount, recentReports] = await Promise.all([
      prisma.client.count({ where: { active: true } }),
      prisma.report.count(),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { client: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return NextResponse.json({ clientCount, reportCount, recentReports });
  } catch (error: unknown) {
    console.error("[DASHBOARD API]", error);
    return NextResponse.json({ clientCount: 0, reportCount: 0, recentReports: [] });
  }
}
