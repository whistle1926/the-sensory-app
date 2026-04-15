import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";

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

  // Handle payment.completed
  if (event.event === "payment.completed") {
    // The reference is the booking ID
    const bookingId = event.reference;
    if (bookingId) {
      const booking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "paid",
          paymentRef: event.paymentId,
          status: "confirmed",
        },
      });

      // Credit the private income tracker. Idempotent via (source, reference) unique.
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
    }
  }

  return NextResponse.json({ received: true });
}
