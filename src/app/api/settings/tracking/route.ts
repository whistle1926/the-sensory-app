/**
 * Settings → Tracking. Stores the Microsoft Clarity Project ID.
 *
 * Mirror of /api/settings/email — singleton row keyed by id="default",
 * GET returns a `hasKey` flag rather than the raw ID so the form can't
 * accidentally overwrite a saved value with masked dots (this was the
 * bug that took the Mailcub key offline a few sessions ago).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const row = await prisma.trackingSettings.findUnique({
    where: { id: "default" },
  });
  return NextResponse.json({
    enabled: row?.enabled ?? true,
    hasClarityId: Boolean(row?.clarityProjectId),
    clarityProjectId: "", // never sent back to the client
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    clarityProjectId?: string;
    enabled?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  // Empty string = "leave existing key alone". Only update on real input.
  if (
    typeof body.clarityProjectId === "string" &&
    body.clarityProjectId.trim() !== ""
  ) {
    data.clarityProjectId = body.clarityProjectId.trim().slice(0, 64);
  }

  const row = await prisma.trackingSettings.upsert({
    where: { id: "default" },
    update: data,
    create: {
      id: "default",
      clarityProjectId:
        (data.clarityProjectId as string | undefined) ?? null,
      enabled: (data.enabled as boolean | undefined) ?? true,
    },
  });

  return NextResponse.json({
    enabled: row.enabled,
    hasClarityId: Boolean(row.clarityProjectId),
    clarityProjectId: "",
  });
}
