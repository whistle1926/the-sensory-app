import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAutomations } from "@/lib/booking-automation";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/** GET — list all automations. Seeds the two defaults on first call so a
 * fresh DB is never empty. */
export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureDefaultAutomations();

  const rows = await prisma.bookingAutomation.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(rows);
}
