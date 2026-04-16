import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_WIDGETS = [
  "stat_active_clients",
  "stat_total_reports",
  "new_clients",
  "recent_reports",
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
] as const;

type WidgetKey = (typeof VALID_WIDGETS)[number];

function validateWidgets(widgets: unknown): widgets is WidgetKey[] {
  if (!Array.isArray(widgets)) return false;
  return widgets.every(
    (w) => typeof w === "string" && (VALID_WIDGETS as readonly string[]).includes(w)
  );
}

/** PATCH — update a template. SUPER_ADMIN only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  if (body.widgets !== undefined) {
    if (!validateWidgets(body.widgets)) {
      return NextResponse.json(
        { error: "widgets must be an array of valid widget keys", validKeys: VALID_WIDGETS },
        { status: 400 }
      );
    }
    data.widgets = body.widgets;
  }

  if (typeof body.isDefault === "boolean") {
    if (body.isDefault) {
      // Use a transaction to unset all other defaults, then set this one.
      const template = await prisma.$transaction(async (tx) => {
        await tx.dashTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
        return tx.dashTemplate.update({
          where: { id: templateId },
          data: { ...data, isDefault: true },
        });
      });
      return NextResponse.json(template);
    }
    data.isDefault = false;
  }

  const template = await prisma.dashTemplate.update({
    where: { id: templateId },
    data,
  });

  return NextResponse.json(template);
}

/** DELETE — delete a template. SUPER_ADMIN only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = await params;

  const template = await prisma.dashTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Prevent deleting the only default template.
  if (template.isDefault) {
    const totalCount = await prisma.dashTemplate.count();
    if (totalCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only default template" },
        { status: 400 }
      );
    }
  }

  // Prisma onDelete: SetNull handles nullifying users' dashTemplateId.
  await prisma.dashTemplate.delete({ where: { id: templateId } });

  return NextResponse.json({ ok: true });
}
