import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin GET — list all date overrides
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const overrides = await prisma.dateOverride.findMany({
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    overrides.map((o) => ({
      id: o.id,
      date: o.date.toISOString().split("T")[0],
      available: o.available,
      intervals: o.intervals,
    }))
  );
}

// Admin POST — add or update a date override
// Body: { date: "2026-04-10", available: false, intervals?: [{start:"10:00",end:"14:00"}] }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { date, available, intervals } = body;

  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const dateObj = new Date(date + "T00:00:00Z");

  const override = await prisma.dateOverride.upsert({
    where: { date: dateObj },
    update: {
      available: available ?? false,
      intervals: available ? intervals || [] : null,
    },
    create: {
      date: dateObj,
      available: available ?? false,
      intervals: available ? intervals || [] : null,
    },
  });

  return NextResponse.json({
    id: override.id,
    date: override.date.toISOString().split("T")[0],
    available: override.available,
    intervals: override.intervals,
  });
}

// Admin DELETE — remove a date override
// Body: { id: "..." }
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await prisma.dateOverride.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
