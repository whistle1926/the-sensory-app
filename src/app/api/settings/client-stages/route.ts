import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_STAGES = [
  { label: "New / Awaiting Assessment", colour: "#3B82F6", order: 0, isDefault: true },
  { label: "Active / Ongoing", colour: "#22C55E", order: 1, isDefault: false },
  { label: "Closed / Discharged", colour: "#6B7280", order: 2, isDefault: false },
];

/** GET — return all stages, auto-seed defaults if none exist. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let stages = await prisma.clientStage.findMany({ orderBy: { order: "asc" } });

  // Auto-seed if table is empty (first time visiting).
  if (stages.length === 0) {
    await prisma.$transaction(
      DEFAULT_STAGES.map((s) => prisma.clientStage.create({ data: s }))
    );
    stages = await prisma.clientStage.findMany({ orderBy: { order: "asc" } });
  }

  return NextResponse.json(stages);
}

/** POST — create a new stage. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const colour =
    typeof body.colour === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.colour)
      ? body.colour
      : "#6B7280";

  // Set order to last + 1.
  const last = await prisma.clientStage.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const stage = await prisma.clientStage.create({
    data: { label: body.label.trim(), colour, order, isDefault: false },
  });

  return NextResponse.json(stage, { status: 201 });
}
