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

export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  let body: { amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  const updated = await prisma.privateConfig.upsert({
    where: { id: "singleton" },
    update: { incomeGoal: Math.round(amount) },
    create: { id: "singleton", incomeGoal: Math.round(amount) },
  });

  return NextResponse.json({ incomeGoal: updated.incomeGoal });
}
