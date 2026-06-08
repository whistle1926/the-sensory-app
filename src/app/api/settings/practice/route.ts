/**
 * Settings → Practice. Small admin-editable practice-wide values
 * (singleton id="default"). Currently just the standard SPM link.
 *
 * GET is staff-only (the client-record SPM dialog reads it to pre-fill
 * the link). PUT is staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await prisma.practiceSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({ spmLinkUrl: row?.spmLinkUrl ?? "" });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { spmLinkUrl?: unknown };

  // Validate the link if provided — must be a proper http(s) URL or empty.
  let spmLinkUrl: string | null = null;
  if (typeof body.spmLinkUrl === "string" && body.spmLinkUrl.trim()) {
    const candidate = body.spmLinkUrl.trim();
    if (!/^https?:\/\//i.test(candidate)) {
      return NextResponse.json(
        { error: "The SPM link must start with http:// or https://" },
        { status: 400 },
      );
    }
    spmLinkUrl = candidate.slice(0, 500);
  }

  const row = await prisma.practiceSettings.upsert({
    where: { id: "default" },
    update: { spmLinkUrl },
    create: { id: "default", spmLinkUrl },
  });
  return NextResponse.json({ spmLinkUrl: row.spmLinkUrl ?? "" });
}
