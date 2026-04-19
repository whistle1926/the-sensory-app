import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_WIDGETS = [
  // Dashboard widgets
  "stat_active_clients",
  "stat_total_reports",
  "new_clients",
  "recent_reports",
  // Navigation items
  "nav_dashboard",
  "nav_clients",
  "nav_reports",
  "nav_activities",
  "nav_programmes",
  "nav_bookings",
  "nav_training",
  "nav_tasks",
  "nav_team",
  "nav_settings",
  "nav_invoices",
  "nav_live_sessions",
] as const;

type WidgetKey = (typeof VALID_WIDGETS)[number];

function validateWidgets(widgets: unknown): widgets is WidgetKey[] {
  if (!Array.isArray(widgets)) return false;
  return widgets.every(
    (w) => typeof w === "string" && (VALID_WIDGETS as readonly string[]).includes(w)
  );
}

/** GET — return all templates with user counts. SUPER_ADMIN only. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.dashTemplate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  const result = templates.map(({ _count, ...rest }) => ({
    ...rest,
    _userCount: _count.users,
  }));

  return NextResponse.json(result);
}

/** POST — create a new template. SUPER_ADMIN only. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!validateWidgets(body.widgets)) {
    return NextResponse.json(
      { error: "widgets must be an array of valid widget keys", validKeys: VALID_WIDGETS },
      { status: 400 }
    );
  }

  // If this is the first template, make it the default.
  const count = await prisma.dashTemplate.count();
  const isDefault = count === 0;

  const template = await prisma.dashTemplate.create({
    data: {
      name: body.name.trim(),
      widgets: body.widgets,
      isDefault,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
