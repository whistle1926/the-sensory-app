import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { ensureEnrollment } from "@/lib/course-enrollment";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
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
      await handleCoursePayment(purchaseId, event.paymentId);
    } catch (err) {
      console.error("[WEBHOOK] Course payment handling failed:", err);
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

  // Guest purchase follow-up — if this buyer came through the public
  // storefront without signing in, they have no password set yet. Fire
  // a set-password email so they can access their course. We detect them
  // by the absence of *any* prior PasswordSetupToken usage AND the lack
  // of sign-in activity (best proxy: user has no other enrolments + no
  // tokens already used).
  try {
    await maybeSendSetPasswordEmail(purchase.userId, purchase.course.id, purchase.course.title);
  } catch (err) {
    console.error("[WEBHOOK] set-password email failed:", err);
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

/**
 * Send a set-password link to a freshly-created guest buyer. Idempotent in
 * practice — we check whether the user has ever used a token before. If they
 * already have a real password (i.e. they've logged in), skip; their existing
 * session/auth still works and spamming emails would be noisy.
 */
async function maybeSendSetPasswordEmail(
  userId: string,
  courseId: string,
  courseTitle: string,
) {
  const [user, usedToken] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    }),
    prisma.passwordSetupToken.findFirst({
      where: { userId, usedAt: { not: null } },
      select: { id: true },
    }),
  ]);
  if (!user) return;
  // They've previously set a password — they're a known client, don't resend.
  if (usedToken) return;
  // Only email CLIENTs (staff log in normally).
  if (user.role !== "CLIENT") return;

  const token = randomBytes(18).toString("base64url");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.passwordSetupToken.create({
    data: { userId, token, expiresAt: expires },
  });

  const base =
    (process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "").replace(/\/$/, "") || "https://sensory.aiworldexperts.com";
  const setUrl = `${base}/set-password?token=${token}`;
  const courseUrl = `${base}/portal/training/${courseId}`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 16px;font-size:22px">Your course is ready</h1>
      <p style="font-size:14px;color:#333;line-height:1.6">
        Thanks for purchasing <strong>${escapeHtml(courseTitle)}</strong>. Set a
        password and you can jump in straight away — you'll also be able to
        revisit the course any time.
      </p>
      <div style="margin-top:20px">
        <a href="${escapeHtml(setUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Set password &amp; start course
        </a>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#888;line-height:1.5">
        Already set a password? <a href="${escapeHtml(courseUrl)}">Open the course</a>.
        This set-password link expires in 14 days.
      </p>
    </div>
  </body></html>`;

  await sendTransactionalEmail({
    to: user.email,
    subject: `Your course is ready — ${courseTitle}`,
    html,
  });
}
