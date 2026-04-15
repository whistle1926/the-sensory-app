import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { ensureEnrollment } from "@/lib/course-enrollment";

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
      await handleCoursePayment(purchaseId, event.paymentId);
    } catch (err) {
      console.error("[WEBHOOK] Course payment handling failed:", err);
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
  }

  return NextResponse.json({ received: true });
}

async function handleCoursePayment(purchaseId: string, paymentId: string) {
  const purchase = await prisma.coursePurchase.findUnique({
    where: { id: purchaseId },
    include: { course: { select: { id: true, title: true } } },
  });
  if (!purchase) {
    console.warn("[WEBHOOK] course purchase not found:", purchaseId);
    return;
  }

  // Idempotent short-circuit — webhook can fire twice, or the returning user
  // can race the webhook. Only mutate on the first "paid" transition.
  if (purchase.paymentStatus === "paid") return;

  await prisma.coursePurchase.update({
    where: { id: purchaseId },
    data: {
      paymentStatus: "paid",
      paymentRef: paymentId,
      completedAt: new Date(),
    },
  });

  // Seed the enrolment (idempotent — ensureEnrollment no-ops if it exists).
  try {
    await ensureEnrollment(purchase.userId, purchase.courseId);
  } catch (err) {
    console.error("[WEBHOOK] ensureEnrollment failed:", err);
  }

  // Credit the private income tracker. Idempotent via (source, reference).
  if (purchase.amount > 0) {
    try {
      await prisma.incomeEntry.upsert({
        where: {
          source_reference: { source: "FIREBUDDY", reference: purchase.id },
        },
        update: {
          amount: purchase.amount,
          description: `${purchase.course.title} — course purchase`,
        },
        create: {
          amount: purchase.amount,
          source: "FIREBUDDY",
          reference: purchase.id,
          description: `${purchase.course.title} — course purchase`,
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[WEBHOOK] Failed to credit income tracker:", err);
    }
  }
}
