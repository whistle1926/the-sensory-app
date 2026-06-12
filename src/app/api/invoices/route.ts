import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [invoices, aggregates] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        clientName: true,
        clientEmail: true,
        currency: true,
        status: true,
        dueDate: true,
        subtotal: true,
        tax: true,
        total: true,
        paymentRef: true,
        paymentUrl: true,
        paidAt: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  // Build aggregate stats
  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let totalOverdue = 0;
  const countsByStatus: Record<string, number> = {};

  for (const group of aggregates) {
    const sum = group._sum.total ?? 0;
    const count = group._count.id;
    countsByStatus[group.status] = count;
    totalInvoiced += sum;

    if (group.status === "paid") {
      totalPaid += sum;
    } else if (group.status === "overdue") {
      totalOverdue += sum;
      totalUnpaid += sum;
    } else if (group.status === "sent" || group.status === "draft") {
      totalUnpaid += sum;
    }
  }

  // Flat per-status counts the list page reads directly (it was
  // reading stats.countPaid etc. which didn't exist → "undefined
  // invoices" / "NaN outstanding" on the KPI cards). countAll is the
  // total across every status.
  const countDraft = countsByStatus.draft ?? 0;
  const countSent = countsByStatus.sent ?? 0;
  const countPaid = countsByStatus.paid ?? 0;
  const countOverdue = countsByStatus.overdue ?? 0;
  const countCancelled = countsByStatus.cancelled ?? 0;
  const countAll = Object.values(countsByStatus).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    invoices,
    stats: {
      totalInvoiced,
      totalPaid,
      totalUnpaid,
      totalOverdue,
      countsByStatus,
      countAll,
      countDraft,
      countSent,
      countPaid,
      countOverdue,
      countCancelled,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { clientId, clientName, clientEmail, clientAddress, currency, dueDate, notes, items, taxLabel: taxLabelRaw, taxRate: taxRateRaw } = body;
  // Validate currency against the enabled list in payment settings.
  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
    select: { currencies: true },
  });
  const enabled = new Set<string>(paymentSettings?.currencies ?? []);
  enabled.add("GBP");
  enabled.add("EUR");
  const invoiceCurrency = enabled.has(currency) ? currency : "GBP";

  // Validate required fields
  if (!clientName || typeof clientName !== "string") {
    return NextResponse.json({ error: "clientName is required" }, { status: 400 });
  }
  if (!clientEmail || typeof clientEmail !== "string") {
    return NextResponse.json({ error: "clientEmail is required" }, { status: 400 });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!dueDate) {
    return NextResponse.json({ error: "dueDate is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  // Validate each item
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

  // Generate invoice number: INV-0110, INV-0111, etc.
  // Grace asked us to start the sequence at 110, so we floor the next
  // number at 110 — the first real invoice is INV-0110 and it just
  // increments from there. (Existing low-numbered test invoices don't
  // affect this; the floor is idempotent.)
  const INVOICE_START = 110;
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = INVOICE_START;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/^INV-(\d+)$/);
    if (match) {
      nextNum = Math.max(parseInt(match[1], 10) + 1, INVOICE_START);
    }
  }
  const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;

  // Calculate totals
  const calculatedItems = items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.quantity * item.unitPrice,
  }));

  const subtotal = calculatedItems.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);

  // Tax: only apply a rate the form explicitly picked. No tax is the
  // default now (Grace's request) — we no longer auto-apply the highest
  // enabled rate when none is sent, so an omitted/zero rate = no tax.
  let tax = 0;
  let selectedRate = 0;
  if (typeof taxRateRaw === "number" && taxRateRaw > 0) {
    selectedRate = taxRateRaw;
  }
  if (selectedRate > 0) {
    tax = Math.round((subtotal * selectedRate) / 100);
  }
  // Record the label that was applied so notes/email templates can show it.
  const appliedTaxLabel =
    typeof taxLabelRaw === "string" && taxLabelRaw.trim()
      ? taxLabelRaw.trim()
      : undefined;
  // Attach label to notes if provided and notes are missing? Leave notes alone;
  // label lives in the totals row on the email template.
  void appliedTaxLabel;
  const total = subtotal + tax;

  const addressSnapshot =
    typeof clientAddress === "string" && clientAddress.trim()
      ? clientAddress.trim()
      : null;

  // Create invoice + items in a transaction.
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: clientId || null,
        clientName: clientName.trim(),
        clientEmail: clientEmail.toLowerCase().trim(),
        clientAddress: addressSnapshot,
        currency: invoiceCurrency,
        dueDate: new Date(dueDate),
        notes: notes || null,
        subtotal,
        tax,
        total,
        items: {
          create: calculatedItems,
        },
      },
      include: { items: true },
    });
    // Remember the address on the client so the next invoice pre-fills
    // it. Only write when we have both a linked client and an address —
    // never blank out a saved address with an empty field.
    if (clientId && addressSnapshot) {
      await tx.client.update({
        where: { id: clientId },
        data: { address: addressSnapshot },
      });
    }
    return inv;
  });

  return NextResponse.json(invoice, { status: 201 });
}
