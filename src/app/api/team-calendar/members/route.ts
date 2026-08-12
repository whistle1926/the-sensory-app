/**
 * PATCH /api/team-calendar/members
 *
 * Show or hide a person on the shared Team Calendar.
 *
 * Deliberately not a disconnect: their Google connection stays, their own
 * bookings keep syncing, and their events keep flowing to their own diary.
 * This only decides whether the practice's shared view reads their calendar
 * — for a tester account, or someone whose personal diary isn't the team's
 * business.
 *
 * Admins can hide anyone; everyone else can only hide themselves.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "TEAM_MANAGER"];

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const show = body.show;
  if (!userId || typeof show !== "boolean") {
    return NextResponse.json({ error: "Say who, and whether to show them." }, { status: 400 });
  }

  if (userId !== session.user.id && !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json(
      { error: "You can only remove yourself from the team calendar." },
      { status: 403 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true },
  });
  if (!target || target.role === "CLIENT") {
    return NextResponse.json({ error: "No such team member." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { showOnTeamCalendar: show },
  });

  return NextResponse.json({ ok: true, name: target.name, show });
}
