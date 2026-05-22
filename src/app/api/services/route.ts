/**
 * Services catalogue — billing-only price list used by the invoice
 * builder. Distinct from /api/booking-services (which powers /book).
 *
 *   GET   /api/services          — list. Staff sees all rows; the
 *                                  optional ?currency=GBP filters by
 *                                  currency for the invoice picker.
 *                                  ?all=1 includes inactive rows for
 *                                  the catalogue editor.
 *   POST  /api/services          — create a draft row, returned for
 *                                  immediate inline editing.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = req.nextUrl.searchParams.get("all") === "1";
  const currency = req.nextUrl.searchParams.get("currency")?.toUpperCase();

  const rows = await prisma.service.findMany({
    where: {
      ...(all ? {} : { isActive: true }),
      ...(currency ? { currency } : {}),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    currency?: string;
  };
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 200)
      : "New service";
  const currency =
    typeof body.currency === "string" && body.currency.trim()
      ? body.currency.trim().toUpperCase().slice(0, 3)
      : "GBP";

  const last = await prisma.service.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.service.create({
    data: {
      name,
      currency,
      order: (last?.order ?? -1) + 1,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
