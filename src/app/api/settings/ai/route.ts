import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.aiSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    return NextResponse.json({
      provider: "anthropic",
      apiKey: "",
      model: "claude-sonnet-4-6",
      enabled: false,
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    model: settings.model,
    enabled: settings.enabled,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { apiKey, model, enabled } = body;

  if (apiKey !== undefined && typeof apiKey !== "string")
    return NextResponse.json({ error: "Invalid apiKey" }, { status: 400 });

  const existing = await prisma.aiSettings.findUnique({
    where: { id: "default" },
  });

  const data: Record<string, unknown> = {};
  // Only update the key if it's a real value (not the masked placeholder)
  if (apiKey !== undefined && !apiKey.includes("•")) data.apiKey = apiKey;
  if (model !== undefined) data.model = model;
  if (enabled !== undefined) data.enabled = enabled;

  let settings;
  if (existing) {
    settings = await prisma.aiSettings.update({
      where: { id: "default" },
      data,
    });
  } else {
    settings = await prisma.aiSettings.create({
      data: {
        id: "default",
        apiKey: apiKey || null,
        model: model || "claude-sonnet-4-6",
        enabled: enabled ?? false,
        ...data,
      },
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    model: settings.model,
    enabled: settings.enabled,
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
}
