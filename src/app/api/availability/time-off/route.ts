/**
 * Staff time off — whole days that apply to every service a person runs.
 *
 *   GET                       → upcoming + recent time off (admin: everyone;
 *                               associate: their own)
 *   POST   { userId, startDate, endDate, note }   (userId null = practice)
 *   PATCH  ?id=…  same body
 *   DELETE ?id=…
 *
 * Admins can set anyone's (and the practice's); associates only their own.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/booking-auth";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function shape(t: { id: string; userId: string | null; startDate: Date; endDate: Date; note: string }) {
  return {
    id: t.id,
    userId: t.userId,
    startDate: t.startDate.toISOString().slice(0, 10),
    endDate: t.endDate.toISOString().slice(0, 10),
    note: t.note,
  };
}

async function guard() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) return null;
  return { id: session.user.id, admin: session.user.role === "SUPER_ADMIN" };
}

/** Validate a body; returns the data to write, or an error message. */
async function parse(
  body: Record<string, unknown>,
  me: { id: string; admin: boolean },
): Promise<{ data: { userId: string | null; startDate: Date; endDate: Date; note: string } } | { error: string }> {
  const userId = body.userId === null || body.userId === "" ? null : String(body.userId ?? "");
  const start = String(body.startDate ?? "");
  const end = String(body.endDate || body.startDate || "");
  if (!DAY.test(start) || !DAY.test(end)) return { error: "Choose the dates." };
  if (end < start) return { error: "The end date is before the start date." };
  if (!me.admin && userId !== me.id) return { error: "You can only set your own time off." };
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!u || !isStaff(u.role)) return { error: "Choose a team member." };
  }
  return {
    data: {
      userId,
      startDate: new Date(`${start}T00:00:00Z`),
      endDate: new Date(`${end}T00:00:00Z`),
      note: String(body.note ?? "").trim().slice(0, 120),
    },
  };
}

export async function GET() {
  const me = await guard();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.staffTimeOff.findMany({
    where: {
      // Keep the last fortnight visible so a just-finished week isn't lost.
      endDate: { gte: new Date(Date.now() - 14 * 864e5) },
      ...(me.admin ? {} : { userId: me.id }),
    },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(rows.map(shape));
}

export async function POST(req: NextRequest) {
  const me = await guard();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = await parse(await req.json().catch(() => ({})), me);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const row = await prisma.staffTimeOff.create({ data: { ...parsed.data, createdById: me.id } });
  return NextResponse.json(shape(row), { status: 201 });
}

async function ownedRow(id: string | null, me: { id: string; admin: boolean }) {
  if (!id) return null;
  const row = await prisma.staffTimeOff.findUnique({ where: { id } });
  if (!row || (!me.admin && row.userId !== me.id)) return null;
  return row;
}

export async function PATCH(req: NextRequest) {
  const me = await guard();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const row = await ownedRow(req.nextUrl.searchParams.get("id"), me);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = await parse(await req.json().catch(() => ({})), me);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updated = await prisma.staffTimeOff.update({ where: { id: row.id }, data: parsed.data });
  return NextResponse.json(shape(updated));
}

export async function DELETE(req: NextRequest) {
  const me = await guard();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const row = await ownedRow(req.nextUrl.searchParams.get("id"), me);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.staffTimeOff.delete({ where: { id: row.id } });
  return NextResponse.json({ success: true });
}
