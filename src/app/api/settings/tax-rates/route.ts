import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CURRENCIES = ["GBP", "EUR", "USD"] as const;

// GET — returns every tax rate row (multiple per currency allowed).
// Public to authenticated users so invoice creation can read enabled options.
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = await prisma.taxRate.findMany({
    orderBy: [{ currency: "asc" }, { rate: "desc" }],
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      currency: r.currency,
      label: r.label,
      rate: r.rate,
      enabled: r.enabled,
    })),
  );
}

// PUT — replace entire set of tax rates. SUPER_ADMIN only.
// Body: Array<{ currency, label, rate, enabled }>
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Expected an array of tax rates" },
      { status: 400 },
    );
  }

  const validCurrencies = new Set<string>(CURRENCIES);
  for (const entry of body) {
    if (!validCurrencies.has(entry.currency)) {
      return NextResponse.json(
        { error: `Invalid currency: ${entry.currency}` },
        { status: 400 },
      );
    }
    if (
      typeof entry.rate !== "number" ||
      entry.rate < 0 ||
      entry.rate > 100
    ) {
      return NextResponse.json(
        { error: `Invalid rate for ${entry.currency}` },
        { status: 400 },
      );
    }
    if (typeof entry.label !== "string" || entry.label.trim() === "") {
      return NextResponse.json(
        { error: `Label required for ${entry.currency}` },
        { status: 400 },
      );
    }
  }

  // Simple replace-all — wipe then re-insert. Safe because tax rates are
  // config-level data; the snapshot label/rate already lives on each invoice.
  await prisma.$transaction([
    prisma.taxRate.deleteMany({}),
    prisma.taxRate.createMany({
      data: body.map(
        (entry: {
          currency: string;
          label: string;
          rate: number;
          enabled?: boolean;
        }) => ({
          currency: entry.currency,
          label: entry.label.trim(),
          rate: entry.rate,
          enabled: entry.enabled ?? true,
        }),
      ),
    }),
  ]);

  const rows = await prisma.taxRate.findMany({
    orderBy: [{ currency: "asc" }, { rate: "desc" }],
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      currency: r.currency,
      label: r.label,
      rate: r.rate,
      enabled: r.enabled,
    })),
  );
}
