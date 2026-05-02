import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_AUTOMATIONS } from "@/lib/booking-automation";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

interface PatchBody {
  enabled?: boolean;
  label?: string;
  description?: string;
  subject?: string;
  bodyHtml?: string;
  /** Sentinel — if true, server overwrites subject + body with the
   * shipped default for this automation key (only meaningful for
   * `isDefault` rows). Saves the UI from having to know the copy. */
  resetToDefault?: boolean;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  const existing = await prisma.bookingAutomation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.label === "string") data.label = body.label.slice(0, 120);
  if (typeof body.description === "string") {
    data.description = body.description.slice(0, 1000);
  }
  if (typeof body.subject === "string") data.subject = body.subject.slice(0, 500);
  if (typeof body.bodyHtml === "string") {
    data.bodyHtml = body.bodyHtml.slice(0, 50_000);
  }

  if (body.resetToDefault) {
    const def =
      DEFAULT_AUTOMATIONS[existing.key as keyof typeof DEFAULT_AUTOMATIONS];
    if (def) {
      data.subject = def.subject;
      data.bodyHtml = def.bodyHtml;
      data.label = def.label;
      data.description = def.description;
    }
  }

  const updated = await prisma.bookingAutomation.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.bookingAutomation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Defaults aren't deletable — they're referenced by send code by key.
  // Disable instead.
  if (existing.isDefault) {
    return NextResponse.json(
      { error: "Default automations can't be deleted. Disable them instead." },
      { status: 400 },
    );
  }
  await prisma.bookingAutomation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
