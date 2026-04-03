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
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "paid",
          paymentRef: event.paymentId,
          status: "confirmed",
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
