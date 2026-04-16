import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT — save the current user's preferred sidebar order.
// Body: { order: string[] }  array of navKey values ("nav_dashboard", …)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const order = body?.order;
  if (!Array.isArray(order) || !order.every((k) => typeof k === "string")) {
    return NextResponse.json(
      { error: "Expected { order: string[] }" },
      { status: 400 },
    );
  }

  // Keep it sane — only nav_ keys, no dupes, reasonable length.
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const k of order) {
    if (!k.startsWith("nav_")) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    clean.push(k);
    if (clean.length > 50) break;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { navOrder: clean },
  });

  return NextResponse.json({ order: clean });
}
