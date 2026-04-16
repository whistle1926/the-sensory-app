import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CURRENCIES = ["GBP", "EUR", "USD"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.taxRate.findMany({ orderBy: { currency: "asc" } });

  // Build a map of existing rows
  const byCurrency: Record<string, typeof rows[number]> = {};
  for (const r of rows) byCurrency[r.currency] = r;

  // Return one entry per supported currency, filling defaults for any missing
  const result = CURRENCIES.map((cur) => {
    const existing = byCurrency[cur];
    if (existing) {
      return {
        currency: existing.currency,
        label: existing.label,
        rate: existing.rate,
        enabled: existing.enabled,
      };
    }
    return {
      currency: cur,
      label: cur === "USD" ? "Sales Tax" : "VAT",
      rate: 0,
      enabled: false,
    };
  });

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an array of tax rates" }, { status: 400 });
  }

  const validCurrencies = new Set<string>(CURRENCIES);

  for (const entry of body) {
    if (!validCurrencies.has(entry.currency)) {
      return NextResponse.json({ error: `Invalid currency: ${entry.currency}` }, { status: 400 });
    }
    if (typeof entry.rate !== "number" || entry.rate < 0 || entry.rate > 100) {
      return NextResponse.json({ error: `Invalid rate for ${entry.currency}` }, { status: 400 });
    }
  }

  // Upsert each rate
  await prisma.$transaction(
    body.map((entry: { currency: string; label?: string; rate: number; enabled?: boolean }) =>
      prisma.taxRate.upsert({
        where: { currency: entry.currency },
        update: {
          label: entry.label || "VAT",
          rate: entry.rate,
          enabled: entry.enabled ?? false,
        },
        create: {
          currency: entry.currency,
          label: entry.label || "VAT",
          rate: entry.rate,
          enabled: entry.enabled ?? false,
        },
      })
    )
  );

  // Return the updated set
  const rows = await prisma.taxRate.findMany({ orderBy: { currency: "asc" } });
  const result = rows.map((r) => ({
    currency: r.currency,
    label: r.label,
    rate: r.rate,
    enabled: r.enabled,
  }));

  return NextResponse.json(result);
}
