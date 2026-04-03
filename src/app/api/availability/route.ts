import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Public GET — returns enabled slots for the booking page
export async function GET() {
  const slots = await prisma.availabilitySlot.findMany({
    where: { enabled: true },
    orderBy: [{ dayOfWeek: "asc" }, { time: "asc" }],
  });

  return NextResponse.json(slots);
}

// Admin POST — bulk set availability for a day
// Body: { dayOfWeek: number, slots: string[] }  e.g. { dayOfWeek: 1, slots: ["09:00","09:30","10:00"] }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { dayOfWeek, slots } = body as { dayOfWeek: number; slots: string[] };

  if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 5) {
    return NextResponse.json({ error: "dayOfWeek must be 1-5 (Mon-Fri)" }, { status: 400 });
  }

  // Delete all existing slots for this day
  await prisma.availabilitySlot.deleteMany({ where: { dayOfWeek } });

  // Create new slots
  if (slots && slots.length > 0) {
    await prisma.availabilitySlot.createMany({
      data: slots.map((time) => ({ dayOfWeek, time, enabled: true })),
    });
  }

  // Return all slots for the full week
  const allSlots = await prisma.availabilitySlot.findMany({
    where: { enabled: true },
    orderBy: [{ dayOfWeek: "asc" }, { time: "asc" }],
  });

  return NextResponse.json(allSlots);
}
