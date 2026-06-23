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
      hasKey: false,
      senderEmail: "",
      senderName: "The Sensory Submarine",
      enabled: false,
    });
  }

  // Return an EMPTY apiKey field plus a `hasKey` flag instead of a masked
  // version. This was changed after a near-miss where the masked dots
  // (`••••`) looked like part of the key and the user typed over them,
  // overwriting a working Mailcub key with a password they thought
  // belonged in a different field. Now the form shows "API key saved"
  // and only updates the DB if the user pastes a fresh non-empty value.
  return NextResponse.json({
    provider: settings.provider,
    apiKey: "",
    hasKey: Boolean(settings.apiKey),
    senderEmail: settings.senderEmail || "",
    senderName: settings.senderName,
    replyTo: settings.replyTo || "",
    enabled: settings.enabled,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { apiKey, senderEmail, senderName, replyTo, enabled } = body;

  if (apiKey !== undefined && typeof apiKey !== "string")
    return NextResponse.json({ error: "Invalid apiKey" }, { status: 400 });
  if (senderEmail !== undefined && typeof senderEmail !== "string")
    return NextResponse.json({ error: "Invalid senderEmail" }, { status: 400 });
  if (replyTo !== undefined && typeof replyTo !== "string")
    return NextResponse.json({ error: "Invalid replyTo" }, { status: 400 });

  const existing = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });

  const data: Record<string, unknown> = {};
  // Only update the API key if the user submitted a non-empty value.
  // Empty string means "leave the existing key alone" — prevents the
  // form from blanking the key on every save.
  if (apiKey !== undefined && apiKey !== "" && !apiKey.includes("•")) {
    data.apiKey = apiKey;
  }
  if (senderEmail !== undefined) data.senderEmail = senderEmail;
  if (senderName !== undefined) data.senderName = senderName;
  if (replyTo !== undefined) data.replyTo = replyTo.trim() || null;
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
    apiKey: "",
    hasKey: Boolean(settings.apiKey),
    senderEmail: settings.senderEmail || "",
    senderName: settings.senderName,
    enabled: settings.enabled,
  });
}
