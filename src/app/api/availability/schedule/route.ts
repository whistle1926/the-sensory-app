import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin GET — returns the full weekly schedule
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.weeklyHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });

  // Build a full 0-6 map (Sun-Sat)
  const schedule: Record<number, { enabled: boolean; intervals: { start: string; end: string }[] }> = {};
  for (let d = 0; d <= 6; d++) {
    const row = rows.find((r) => r.dayOfWeek === d);
    schedule[d] = row
      ? { enabled: row.enabled, intervals: row.intervals as unknown as { start: string; end: string }[] }
      : { enabled: false, intervals: [] };
  }

  return NextResponse.json(schedule);
}

// Admin POST — save the full weekly schedule
// Body: { "0": { enabled: false, intervals: [] }, "1": { enabled: true, intervals: [{start:"09:00",end:"17:00"}] }, ... }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  for (let d = 0; d <= 6; d++) {
    const day = body[String(d)];
    if (!day) continue;

    await prisma.weeklyHours.upsert({
      where: { dayOfWeek: d },
      update: {
        enabled: day.enabled ?? false,
        intervals: day.intervals ?? [],
      },
      create: {
        dayOfWeek: d,
        enabled: day.enabled ?? false,
        intervals: day.intervals ?? [],
      },
    });
  }

  // Return updated schedule
  const rows = await prisma.weeklyHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });

  const schedule: Record<number, { enabled: boolean; intervals: { start: string; end: string }[] }> = {};
  for (let d = 0; d <= 6; d++) {
    const row = rows.find((r) => r.dayOfWeek === d);
    schedule[d] = row
      ? { enabled: row.enabled, intervals: row.intervals as unknown as { start: string; end: string }[] }
      : { enabled: false, intervals: [] };
  }

  return NextResponse.json(schedule);
}
