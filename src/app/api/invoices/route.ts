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

  return NextResponse.json({
    invoices,
    stats: {
      totalInvoiced,
      totalPaid,
      totalUnpaid,
      totalOverdue,
      countsByStatus,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { clientId, clientName, clientEmail, currency, dueDate, notes, items } = body;
  const validCurrencies = ["GBP", "EUR", "USD"];
  const invoiceCurrency = validCurrencies.includes(currency) ? currency : "GBP";

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

  // Generate invoice number: INV-0001, INV-0002, etc.
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/^INV-(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
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

  // Look up tax rate for this currency
  let tax = 0;
  const taxRate = await prisma.taxRate.findUnique({ where: { currency: invoiceCurrency } });
  if (taxRate?.enabled && taxRate.rate > 0) {
    tax = Math.round(subtotal * taxRate.rate / 100);
  }
  const total = subtotal + tax;

  // Create invoice + items in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: clientId || null,
        clientName: clientName.trim(),
        clientEmail: clientEmail.toLowerCase().trim(),
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
    return inv;
  });

  return NextResponse.json(invoice, { status: 201 });
}
