/**
 * Per-user personal-note presets for the report-summary dialog.
 *
 *   GET — returns the caller's saved presets.
 *   PUT — replaces the whole list. Body: { presets: Preset[] }.
 *
 * Same JSON-on-User design as /api/settings/signatures — small list,
 * always loaded together, one writer.
 *
 * Supports a single template token, {{clientName}}, substituted on
 * the client at apply time. We don't substitute server-side because
 * the preset stays a template — the client may apply it then edit
 * before sending.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PRESETS = 10;
const MAX_LABEL_LEN = 60;
const MAX_BODY_LEN = 1000;

interface Preset {
  id: string;
  label: string;
  body: string;
}

function sanitisePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  const out: Preset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL_LEN) : "";
    const body = typeof o.body === "string" ? o.body.trim().slice(0, MAX_BODY_LEN) : "";
    if (!label || !body) continue;
    let id = typeof o.id === "string" && o.id ? o.id : randomUUID();
    if (seen.has(id)) id = randomUUID();
    seen.add(id);
    out.push({ id, label, body });
    if (out.length >= MAX_PRESETS) break;
  }
  return out;
}

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personalNotePresets: true },
  });
  return NextResponse.json({
    presets: sanitisePresets(user?.personalNotePresets),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { presets?: unknown };
  const next = sanitisePresets(body.presets);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { personalNotePresets: next as unknown as never },
  });
  return NextResponse.json({ presets: next });
}
