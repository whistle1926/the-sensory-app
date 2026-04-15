import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/private-pin";

async function guard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  let body: { amount?: unknown; description?: unknown; occurredAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 280)
      : null;

  let occurredAt: Date | undefined;
  if (typeof body.occurredAt === "string") {
    const d = new Date(body.occurredAt);
    if (!isNaN(d.getTime())) occurredAt = d;
  }

  const entry = await prisma.incomeEntry.create({
    data: {
      amount: Math.round(amount),
      source: "MANUAL",
      description,
      ...(occurredAt ? { occurredAt } : {}),
    },
  });

  return NextResponse.json({
    entry: {
      id: entry.id,
      amount: entry.amount,
      source: entry.source,
      description: entry.description,
      reference: entry.reference,
      occurredAt: entry.occurredAt.toISOString(),
    },
  });
}
