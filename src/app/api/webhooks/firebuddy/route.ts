import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { completeCoursePurchase } from "@/lib/course-purchase-complete";
import { sendBookingReferralForm } from "@/lib/booking-referral";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-firebuddy-signature");
  const rawBody = await req.text();

  // Get webhook secret from settings
  const settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.webhookSecret) {
    console.error("FireBuddy webhook received but no webhook secret configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Verify signature
  let event;
  try {
    event = await FireBuddy.verifyWebhook(signature, rawBody, settings.webhookSecret);
  } catch (err) {
    console.error("FireBuddy webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.event !== "payment.completed") {
    return NextResponse.json({ received: true });
  }

  const reference = event.reference ?? "";

  // Course purchase branch: reference format is "course:<purchaseId>".
  // Always check prefix BEFORE falling through to the booking path — booking
  // ids are cuids and never contain a colon, so there's no ambiguity.
  if (reference.startsWith("course:")) {
    const purchaseId = reference.slice("course:".length);
    try {
      await completeCoursePurchase(purchaseId, event.paymentId);
    } catch (err) {
      console.error("[WEBHOOK] Course payment handling failed:", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  // A checkout with add-ons settles as ONE payment covering several course
  // rows; fan it back out so each grants its own enrolment.
  if (reference.startsWith("courseGroup:")) {
    const groupId = reference.slice("courseGroup:".length);
    try {
      const rows = await prisma.coursePurchase.findMany({
        where: { groupId },
        select: { id: true },
      });
      // One row failing must not strand the rest of a paid order — the
      // buyer has been charged for all of it.
      for (const row of rows) {
        try {
          await completeCoursePurchase(row.id, event.paymentId);
        } catch (err) {
          console.error("[WEBHOOK] group line failed:", row.id, err);
        }
      }
    } catch (err) {
      console.error("[WEBHOOK] Course group handling failed:", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  // Invoice branch: reference format is "invoice:<invoiceId>".
  if (reference.startsWith("invoice:")) {
    const invoiceId = reference.slice("invoice:".length);
    try {
      await handleInvoicePayment(invoiceId, event.paymentId, event.amount, event.currency);
    } catch (err) {
      console.error("[WEBHOOK] Invoice payment handling failed:", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  // Block-booking branch: reference is "group:<groupId>" — one payment
  // covers every session in the block, so confirm them all together.
  if (reference.startsWith("group:")) {
    const groupId = reference.slice("group:".length);
    try {
      await handleBlockPayment(groupId, event.paymentId);
    } catch (err) {
      console.error("[WEBHOOK] Block booking payment handling failed:", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  // Booking branch (legacy path — reference is the booking id directly).
  if (reference) {
    const booking = await prisma.booking.update({
      where: { id: reference },
      data: {
        paymentStatus: "paid",
        paymentRef: event.paymentId,
        status: "confirmed",
      },
    });

    if (booking.price > 0) {
      try {
        await prisma.incomeEntry.upsert({
          where: { source_reference: { source: "BOOKING", reference: booking.id } },
          update: { amount: booking.price, description: `${booking.service} — ${booking.clientName}` },
          create: {
            amount: booking.price,
            source: "BOOKING",
            reference: booking.id,
            description: `${booking.service} — ${booking.clientName}`,
            occurredAt: new Date(),
          },
        });
      } catch (err) {
        console.error("[WEBHOOK] Failed to credit income tracker:", err);
      }
    }

    // Auto-send the intake/referral form on payment, if this service is
    // opted in (e.g. OT assessments). Best-effort + idempotent — never
    // let it disturb the payment handling.
    try {
      const result = await sendBookingReferralForm(booking.id);
      if (result.sent) {
        console.log(
          `[WEBHOOK] Referral form sent for booking ${booking.id} → ${result.to}`,
        );
      }
    } catch (err) {
      console.error("[WEBHOOK] Referral form auto-send failed:", err);
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * A block booking is several linked sessions paid by ONE payment request
 * (reference "group:<id>"). Confirm every session, but credit the income
 * tracker and send the referral form only once for the block.
 */
async function handleBlockPayment(groupId: string, paymentId: string) {
  const sessions = await prisma.booking.findMany({
    where: { groupId },
    orderBy: { date: "asc" },
  });
  if (sessions.length === 0) {
    console.warn("[WEBHOOK] block booking not found:", groupId);
    return;
  }
  // Idempotent — the webhook can fire twice.
  if (sessions.every((s) => s.paymentStatus === "paid")) return;

  await prisma.booking.updateMany({
    where: { groupId },
    data: { paymentStatus: "paid", paymentRef: paymentId, status: "confirmed" },
  });

  const first = sessions[0];
  // Credit the block's TOTAL once, keyed on the group so a repeat webhook
  // can't double-count it.
  const total = sessions.reduce((sum, s) => sum + s.price, 0);
  if (total > 0) {
    try {
      await prisma.incomeEntry.upsert({
        where: { source_reference: { source: "BOOKING", reference: groupId } },
        update: {
          amount: total,
          description: `${first.service} (${sessions.length} sessions) — ${first.clientName}`,
        },
        create: {
          amount: total,
          source: "BOOKING",
          reference: groupId,
          description: `${first.service} (${sessions.length} sessions) — ${first.clientName}`,
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[WEBHOOK] Failed to credit income tracker for block:", err);
    }
  }

  // One referral form for the block, not one per session.
  try {
    await sendBookingReferralForm(first.id);
  } catch (err) {
    console.error("[WEBHOOK] Referral form auto-send failed for block:", err);
  }
}

async function handleInvoicePayment(
  invoiceId: string,
  paymentId: string,
  amountPounds: number,
  currency?: string,
) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    console.warn("[WEBHOOK] invoice not found:", invoiceId);
    return;
  }

  // Idempotent — skip if already paid
  if (invoice.status === "paid") return;

  // Truth guard — the amount + currency that landed must match the
  // invoice. Stops a test/partial payment from flipping the whole
  // invoice to paid. (Same rule as the pull-based reconcile.)
  const amountPence = Math.round(amountPounds * 100);
  const amountOk = amountPence === invoice.total;
  const currencyOk =
    !currency ||
    currency.toUpperCase() === (invoice.currency || "GBP").toUpperCase();
  if (!amountOk || !currencyOk) {
    console.warn(
      `[WEBHOOK] ${invoice.invoiceNumber}: payment does not match — expected ${invoice.total} ${invoice.currency}, got ${amountPence} ${currency}. NOT marking paid.`,
    );
    return;
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paymentRef: paymentId,
      paidAt: new Date(),
      // Confirmed via Fire → the source of truth.
      paidMethod: "fire",
    },
  });

  // Mirror the paid status onto the matching FireBuddy invoice so
  // the accountant view in Accounting → Invoices reflects reality.
  // Non-fatal — payment is already settled and recorded in our DB.
  if (invoice.firebuddyInvoiceId) {
    try {
      const settings = await prisma.paymentSettings.findUnique({
        where: { id: "default" },
      });
      if (settings?.apiKey) {
        const fb = new FireBuddy(settings.apiKey);
        await fb.updateInvoice(invoice.firebuddyInvoiceId, {
          status: "paid",
        });
      }
    } catch (err) {
      console.error("[WEBHOOK] FireBuddy invoice status patch failed:", err);
    }
  }

  // Credit the private income tracker (amountPence computed above).
  if (amountPence > 0) {
    try {
      await prisma.incomeEntry.upsert({
        where: { source_reference: { source: "INVOICE", reference: invoice.id } },
        update: {
          amount: amountPence,
          description: `${invoice.invoiceNumber} — ${invoice.clientName}`,
        },
        create: {
          amount: amountPence,
          source: "INVOICE",
          reference: invoice.id,
          description: `${invoice.invoiceNumber} — ${invoice.clientName}`,
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[WEBHOOK] Failed to credit income tracker for invoice:", err);
    }
  }
}

