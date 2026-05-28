/**
 * Per-user email signatures.
 *
 *   GET   — returns the caller's saved signatures.
 *   PUT   — replaces the whole list. Body: { signatures: Sig[] }.
 *
 * Storing as JSON on User keeps it simple — we always load all of a
 * user's signatures together (they pick from a dropdown), so there's
 * no value in splitting them into a separate table. The list is
 * capped at 6 to keep the picker scannable.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIGNATURES = 6;
const MAX_LABEL_LEN = 60;
const MAX_BODY_LEN = 2000;

export interface Signature {
  id: string;
  label: string;
  body: string;
}

function sanitiseSignatures(raw: unknown): Signature[] {
  if (!Array.isArray(raw)) return [];
  const out: Signature[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label =
      typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL_LEN) : "";
    const body =
      typeof o.body === "string" ? o.body.trim().slice(0, MAX_BODY_LEN) : "";
    if (!label || !body) continue;
    let id = typeof o.id === "string" && o.id ? o.id : randomUUID();
    if (seenIds.has(id)) id = randomUUID();
    seenIds.add(id);
    out.push({ id, label, body });
    if (out.length >= MAX_SIGNATURES) break;
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
    select: { emailSignatures: true },
  });
  return NextResponse.json({
    signatures: sanitiseSignatures(user?.emailSignatures),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    signatures?: unknown;
  };
  const next = sanitiseSignatures(body.signatures);
  await prisma.user.update({
    where: { id: session.user.id },
    // Prisma's Json column accepts any JSON-serialisable value.
    data: { emailSignatures: next as unknown as never },
  });
  return NextResponse.json({ signatures: next });
}
