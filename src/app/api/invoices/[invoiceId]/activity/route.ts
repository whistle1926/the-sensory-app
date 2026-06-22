import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

/**
 * Sending activity for one invoice — the history of every time it was
 * emailed or shared (e.g. via WhatsApp), so the OT can see at a glance
 * how and when they've chased payment. Built from the audit log.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;

  const entries = await prisma.auditLog.findMany({
    where: {
      targetType: "invoice",
      targetId: invoiceId,
      action: { in: ["invoice.send", "invoice.share.whatsapp"] },
    },
    select: {
      id: true,
      action: true,
      actorLabel: true,
      meta: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ entries });
}

/**
 * Log a non-email share (currently WhatsApp). The actual sending happens
 * in the user's WhatsApp app via a wa.me link; this just records that
 * they shared it, so it shows up in the activity history.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, invoiceNumber: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { channel?: string };
  if (body.channel !== "whatsapp") {
    return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
  }

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "invoice.share.whatsapp",
    targetType: "invoice",
    targetId: invoiceId,
    meta: { invoiceNumber: invoice.invoiceNumber, channel: "WhatsApp" },
    req,
  });

  return NextResponse.json({ ok: true });
}
