import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    webhookSecret: settings.webhookSecret ? maskKey(settings.webhookSecret) : "",
    enabled: settings.enabled,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { apiKey, webhookSecret, enabled } = body;

  const existing = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  const data: Record<string, unknown> = {};
  if (apiKey !== undefined && !apiKey.includes("\u2022")) data.apiKey = apiKey;
  if (webhookSecret !== undefined && !webhookSecret.includes("\u2022")) data.webhookSecret = webhookSecret;
  if (enabled !== undefined) data.enabled = enabled;

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
        ...data,
      },
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    webhookSecret: settings.webhookSecret ? maskKey(settings.webhookSecret) : "",
    enabled: settings.enabled,
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "\u2022".repeat(key.length);
  return key.slice(0, 4) + "\u2022".repeat(key.length - 8) + key.slice(-4);
}
