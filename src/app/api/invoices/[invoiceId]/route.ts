import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { FireBuddy } from "@/lib/firebuddy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, client: true },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "paid") {
    return NextResponse.json({ error: "Cannot edit a paid invoice" }, { status: 400 });
  }

  const body = await req.json();
  const { clientName, clientEmail, clientId, dueDate, notes, status, items } = body;

  // Build the update payload
  const data: Record<string, unknown> = {};

  if (clientName !== undefined) data.clientName = clientName.trim();
  if (clientEmail !== undefined) data.clientEmail = clientEmail.toLowerCase().trim();
  if (clientId !== undefined) data.clientId = clientId || null;
  if (dueDate !== undefined) data.dueDate = new Date(dueDate);
  if (notes !== undefined) data.notes = notes || null;
  if (status !== undefined) {
    const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
    if (status === "paid") data.paidAt = new Date();
  }

  // If items are provided, full-replace and recalculate totals
  if (Array.isArray(items)) {
    if (items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    for (const item of items) {
      if (!item.description || typeof item.description !== "string") {
        return NextResponse.json({ error: "Each item must have a description" }, { status: 400 });
      }
      if (typeof item.quantity !== "number" || item.quantity < 1) {
        return NextResponse.json({ error: "Each item must have a valid quantity" }, { status: 400 });
      }
      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
        return NextResponse.json({ error: "Each item must have a valid unitPrice" }, { status: 400 });
      }
    }

    const calculatedItems = items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));

    const subtotal = calculatedItems.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);

    // Tax: re-apply the existing invoice's rate (proportionally) unless the client
    // sent a new taxRate value. We derive it from the existing stored tax/subtotal,
    // falling back to 0 when the old subtotal is 0 to avoid divide-by-zero.
    let tax = 0;
    const dataWithTax = data as { taxRate?: unknown };
    if (typeof dataWithTax.taxRate === "number" && dataWithTax.taxRate > 0) {
      tax = Math.round((subtotal * (dataWithTax.taxRate as number)) / 100);
      // Strip the transient taxRate key — it's not a column on Invoice.
      delete dataWithTax.taxRate;
    } else if (typeof dataWithTax.taxRate === "number" && dataWithTax.taxRate === 0) {
      tax = 0;
      delete dataWithTax.taxRate;
    } else if (existing.subtotal > 0 && existing.tax > 0) {
      const existingRate = (existing.tax / existing.subtotal) * 100;
      tax = Math.round((subtotal * existingRate) / 100);
    }
    const total = subtotal + tax;

    const invoice = await prisma.$transaction(async (tx) => {
      // Delete all existing items
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });

      // Update invoice with new totals and create new items
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...data,
          subtotal,
          tax,
          total,
          items: { create: calculatedItems },
        },
        include: { items: true, client: true },
      });
    });

    return NextResponse.json(invoice);
  }

  // No items change — just update fields
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data,
    include: { items: true, client: true },
  });

  // Status transitions are worth recording.
  if (data.status === "cancelled" && existing.status !== "cancelled") {
    await recordAudit({
      actorId: session.user.id,
      actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
      action: "invoice.cancel",
      targetType: "invoice",
      targetId: invoiceId,
      meta: {
        invoiceNumber: existing.invoiceNumber,
        previousStatus: existing.status,
      },
      req,
    });
  }

  // ── Manual mark-as-paid: do everything the FireBuddy webhook
  //    would have done if it had fired. Patrick added this fallback
  //    after seeing a paid invoice that the webhook hadn't picked
  //    up. Mirrors src/app/api/webhooks/firebuddy/route.ts so the
  //    two paths produce the same final state.
  if (data.status === "paid" && existing.status !== "paid") {
    // 1. Credit the private income tracker (idempotent on source+ref).
    if (invoice.total > 0) {
      try {
        await prisma.incomeEntry.upsert({
          where: { source_reference: { source: "INVOICE", reference: invoice.id } },
          update: {
            amount: invoice.total,
            description: `${invoice.invoiceNumber} — ${invoice.clientName}`,
          },
          create: {
            amount: invoice.total,
            source: "INVOICE",
            reference: invoice.id,
            description: `${invoice.invoiceNumber} — ${invoice.clientName}`,
            occurredAt: new Date(),
          },
        });
      } catch (err) {
        console.error("[invoice/PATCH] income tracker credit failed:", err);
      }
    }

    // 2. Mirror the paid status to FireBuddy Accounting (if we
    //    created an invoice there at send-time). Best-effort —
    //    payment is already recorded locally.
    if (invoice.firebuddyInvoiceId) {
      try {
        const settings = await prisma.paymentSettings.findUnique({
          where: { id: "default" },
        });
        if (settings?.apiKey) {
          const fb = new FireBuddy(settings.apiKey);
          await fb.updateInvoice(invoice.firebuddyInvoiceId, { status: "paid" });
        }
      } catch (err) {
        console.error("[invoice/PATCH] FireBuddy mirror update failed:", err);
      }
    }

    // 3. Audit so we can tell apart webhook vs manual marks.
    await recordAudit({
      actorId: session.user.id,
      actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
      action: "invoice.send", // closest existing verb; "mark.paid" specific verb is overkill for v1
      targetType: "invoice",
      targetId: invoiceId,
      meta: {
        action: "mark.paid.manual",
        invoiceNumber: existing.invoiceNumber,
        previousStatus: existing.status,
        total: invoice.total,
        currency: invoice.currency,
      },
      req,
    });
  }

  return NextResponse.json(invoice);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceId } = await params;

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "paid") {
    return NextResponse.json({ error: "Cannot delete a paid invoice" }, { status: 400 });
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "invoice.delete",
    targetType: "invoice",
    targetId: invoiceId,
    meta: {
      invoiceNumber: existing.invoiceNumber,
      total: existing.total,
      currency: existing.currency,
      clientId: existing.clientId,
      previousStatus: existing.status,
    },
    req,
  });

  return NextResponse.json({ success: true });
}
