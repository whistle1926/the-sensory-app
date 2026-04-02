import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  return NextResponse.json(reports);
}
