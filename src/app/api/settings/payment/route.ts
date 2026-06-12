import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCore, KNOWN_CURRENCIES } from "@/lib/currencies";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    return NextResponse.json({
      provider: "firebuddy",
      apiKey: "",
      webhookSecret: "",
      enabled: false,
      currencies: ensureCore([]),
      ...emptyBank(),
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    webhookSecret: settings.webhookSecret ? maskKey(settings.webhookSecret) : "",
    enabled: settings.enabled,
    currencies: ensureCore(settings.currencies ?? []),
    ...bankFields(settings),
  });
}

/** Bank details are NOT secret (they're printed on invoices), so they
 *  are returned unmasked. */
function bankFields(s: {
  bankAccountName: string | null;
  bankSortCode: string | null;
  bankAccountNumber: string | null;
  bankEurAccountName: string | null;
  bankIban: string | null;
  bankBic: string | null;
  bankTransferInstructions: string | null;
}) {
  return {
    bankAccountName: s.bankAccountName ?? "",
    bankSortCode: s.bankSortCode ?? "",
    bankAccountNumber: s.bankAccountNumber ?? "",
    bankEurAccountName: s.bankEurAccountName ?? "",
    bankIban: s.bankIban ?? "",
    bankBic: s.bankBic ?? "",
    bankTransferInstructions: s.bankTransferInstructions ?? "",
  };
}

function emptyBank() {
  return {
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",
    bankEurAccountName: "",
    bankIban: "",
    bankBic: "",
    bankTransferInstructions: "",
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    apiKey,
    webhookSecret,
    enabled,
    currencies,
    bankAccountName,
    bankSortCode,
    bankAccountNumber,
    bankEurAccountName,
    bankIban,
    bankBic,
    bankTransferInstructions,
  } = body;

  const existing = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  const data: Record<string, unknown> = {};
  if (apiKey !== undefined && !apiKey.includes("\u2022")) data.apiKey = apiKey;
  if (webhookSecret !== undefined && !webhookSecret.includes("\u2022")) data.webhookSecret = webhookSecret;
  if (enabled !== undefined) data.enabled = enabled;

  // Bank transfer details \u2014 trimmed; empty string clears the field.
  const setBank = (key: string, value: unknown) => {
    if (typeof value === "string") data[key] = value.trim() || null;
  };
  setBank("bankAccountName", bankAccountName);
  setBank("bankSortCode", bankSortCode);
  setBank("bankAccountNumber", bankAccountNumber);
  setBank("bankEurAccountName", bankEurAccountName);
  setBank("bankIban", bankIban);
  setBank("bankBic", bankBic);
  setBank("bankTransferInstructions", bankTransferInstructions);

  if (Array.isArray(currencies)) {
    // Keep only known codes, enforce that GBP & EUR are present.
    const filtered = currencies.filter(
      (c): c is string => typeof c === "string" && KNOWN_CURRENCIES.includes(c),
    );
    data.currencies = ensureCore(filtered);
  }

  let settings;
  if (existing) {
    settings = await prisma.paymentSettings.update({
      where: { id: "default" },
      data,
    });
  } else {
    settings = await prisma.paymentSettings.create({
      data: {
        id: "default",
        apiKey: apiKey || null,
        webhookSecret: webhookSecret || null,
        enabled: enabled ?? false,
        currencies: ensureCore(
          Array.isArray(currencies) ? currencies.filter((c: unknown): c is string => typeof c === "string") : [],
        ),
        ...data,
      },
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    webhookSecret: settings.webhookSecret ? maskKey(settings.webhookSecret) : "",
    enabled: settings.enabled,
    currencies: ensureCore(settings.currencies ?? []),
    ...bankFields(settings),
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "\u2022".repeat(key.length);
  return key.slice(0, 4) + "\u2022".repeat(key.length - 8) + key.slice(-4);
}
