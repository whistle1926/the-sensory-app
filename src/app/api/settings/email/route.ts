import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    return NextResponse.json({
      provider: "mailcub",
      apiKey: "",
      senderEmail: "",
      senderName: "The Sensory Submarine",
      enabled: false,
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    senderEmail: settings.senderEmail || "",
    senderName: settings.senderName,
    enabled: settings.enabled,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { apiKey, senderEmail, senderName, enabled } = body;

  if (apiKey !== undefined && typeof apiKey !== "string")
    return NextResponse.json({ error: "Invalid apiKey" }, { status: 400 });
  if (senderEmail !== undefined && typeof senderEmail !== "string")
    return NextResponse.json({ error: "Invalid senderEmail" }, { status: 400 });

  const existing = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });

  const data: Record<string, unknown> = {};
  if (apiKey !== undefined && !apiKey.includes("•")) data.apiKey = apiKey;
  if (senderEmail !== undefined) data.senderEmail = senderEmail;
  if (senderName !== undefined) data.senderName = senderName;
  if (enabled !== undefined) data.enabled = enabled;

  let settings;
  if (existing) {
    settings = await prisma.emailSettings.update({
      where: { id: "default" },
      data,
    });
  } else {
    settings = await prisma.emailSettings.create({
      data: {
        id: "default",
        apiKey: apiKey || null,
        senderEmail: senderEmail || null,
        senderName: senderName || "The Sensory Submarine",
        enabled: enabled ?? false,
        ...data,
      },
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: settings.apiKey ? maskKey(settings.apiKey) : "",
    senderEmail: settings.senderEmail || "",
    senderName: settings.senderName,
    enabled: settings.enabled,
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
}
