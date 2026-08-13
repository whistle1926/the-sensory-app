/**
 * The email a parent gets after buying a course.
 *
 * Replaces a set-password email that only reached first-time guests. That
 * left a returning customer with nothing at all — they paid and got no
 * confirmation, no receipt and no link — and gave us nowhere to put a
 * "what next".
 *
 * One email, sent to everyone who pays, doing three jobs:
 *   1. Receipt — what they bought, what it cost, when, and a reference.
 *   2. Access — set a password if they haven't got one, otherwise a link
 *      straight into the course.
 *   3. What next — one other course, so the sale can lead somewhere.
 *
 * Idempotent on CoursePurchase.receiptSentAt, because the webhook can fire
 * more than once and nobody should be emailed twice about one payment.
 */
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { sendTransactionalEmail, escapeHtml } from "./email";
import { formatExact, formatPrice, isCurrency, type Currency } from "./course-currency";

function baseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "";
  return raw.replace(/\/$/, "") || "https://portal.thesensorysubmarine.com";
}

function ukDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

/**
 * The course to suggest next. The editor's "next course" field wins so an OT
 * can choose the journey deliberately; otherwise fall back to any other course
 * that is genuinely on sale and that they don't already own. Returns null
 * rather than padding the email with something they can't buy.
 */
async function pickNextCourse(userId: string, boughtCourseId: string, nextCourseId: string | null) {
  const owned = await prisma.coursePurchase.findMany({
    where: { userId, paymentStatus: "paid" },
    select: { courseId: true },
  });
  const ownedIds = new Set(owned.map((o) => o.courseId).concat(boughtCourseId));

  if (nextCourseId && !ownedIds.has(nextCourseId)) {
    const chosen = await prisma.course.findFirst({
      where: { id: nextCourseId, isLive: true, status: "AVAILABLE" },
      select: { title: true, slug: true, price: true, priceEur: true, tagline: true, shortDescription: true },
    });
    if (chosen) return chosen;
  }

  return prisma.course.findFirst({
    where: { id: { notIn: [...ownedIds] }, isLive: true, status: "AVAILABLE" },
    select: { title: true, slug: true, price: true, priceEur: true, tagline: true, shortDescription: true },
    orderBy: { isFeatured: "desc" },
  });
}

export async function sendCoursePurchaseEmail(purchaseId: string): Promise<void> {
  const purchase = await prisma.coursePurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      amount: true,
      completedAt: true,
      createdAt: true,
      receiptSentAt: true,
      currency: true,
      paymentStatus: true,
      userId: true,
      courseId: true,
      course: {
        select: { id: true, title: true, slug: true, nextCourseId: true },
      },
      user: { select: { email: true, name: true, role: true } },
    },
  });
  if (!purchase || purchase.paymentStatus !== "paid") return;
  if (purchase.receiptSentAt) return; // already told them
  if (!purchase.user?.email) return;

  // Claim it first: a second webhook arriving mid-send must not double up.
  await prisma.coursePurchase.update({
    where: { id: purchaseId },
    data: { receiptSentAt: new Date() },
  });

  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
    select: { senderName: true, replyTo: true },
  });
  const businessName = settings?.senderName || "The Sensory Submarine";

  const base = baseUrl();
  const courseUrl = `${base}/portal/training/${purchase.course.id}`;

  // A buyer with no working password can't sign in, so the access button has
  // to be a set-password link. Note that passwordHash is NOT the signal: a
  // guest account is created with a deliberately unusable random hash, so the
  // column is always populated. Having *used* a setup token is what actually
  // means "this person has a password they know".
  let accessUrl = courseUrl;
  let accessLabel = "Open your course";
  let accessNote = "";
  const usedToken = await prisma.passwordSetupToken.findFirst({
    where: { userId: purchase.userId, usedAt: { not: null } },
    select: { id: true },
  });
  const needsPassword = !usedToken && purchase.user.role === "CLIENT";
  if (needsPassword) {
    const token = randomBytes(18).toString("base64url");
    await prisma.passwordSetupToken.create({
      data: {
        userId: purchase.userId,
        token,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    accessUrl = `${base}/set-password?token=${token}`;
    accessLabel = "Set your password & start";
    accessNote =
      "This link sets up your account so you can come back to the course whenever you like. It expires in 14 days.";
  }

  const paid: Currency = isCurrency(purchase.currency) ? purchase.currency : "GBP";
  const next = await pickNextCourse(purchase.userId, purchase.courseId, purchase.course.nextCourseId);
  const nextPrice = next
    ? paid === "EUR" && typeof next.priceEur === "number"
      ? formatPrice(next.priceEur, "EUR")
      : formatPrice(next.price, "GBP")
    : "";
  const paidOn = ukDate(purchase.completedAt ?? purchase.createdAt);
  const reference = purchase.id.slice(-8).toUpperCase();

  const upsell = next
    ? `
      <div style="margin-top:28px;border-top:1px solid #e6e8ee;padding-top:20px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a8194">
          You might like next
        </p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#1a1d26">
          ${escapeHtml(next.title)}
        </p>
        ${
          next.tagline || next.shortDescription
            ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#4a5061">${escapeHtml(
                next.tagline || next.shortDescription || "",
              )}</p>`
            : ""
        }
        <p style="margin:14px 0 0">
          <a href="${escapeHtml(`${base}/courses/${next.slug}`)}"
             style="display:inline-block;border:1px solid #2563eb;color:#2563eb;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
            Have a look${next.price > 0 ? ` — ${nextPrice}` : ""}
          </a>
        </p>
      </div>`
    : "";

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f5f6f9;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">

    <h1 style="margin:0 0 6px;font-size:22px;color:#1a1d26">Thanks — you're all set</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4a5061">
      ${escapeHtml(purchase.user.name || "Hello")}, your purchase of
      <strong>${escapeHtml(purchase.course.title)}</strong> is confirmed and it's
      yours to keep — come back to it as often as you like.
    </p>

    <p style="margin:0 0 26px">
      <a href="${escapeHtml(accessUrl)}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        ${escapeHtml(accessLabel)}
      </a>
    </p>
    ${
      accessNote
        ? `<p style="margin:-16px 0 24px;font-size:12px;line-height:1.5;color:#7a8194">${escapeHtml(accessNote)}</p>`
        : ""
    }

    <div style="border:1px solid #e6e8ee;border-radius:10px;padding:16px">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a8194">
        Your receipt
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1a1d26">
        <tr>
          <td style="padding:4px 0;color:#4a5061">${escapeHtml(purchase.course.title)}</td>
          <td style="padding:4px 0;text-align:right;font-weight:600">${formatExact(purchase.amount, paid)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0 4px;border-top:1px solid #e6e8ee;font-weight:700">Total paid</td>
          <td style="padding:10px 0 4px;border-top:1px solid #e6e8ee;text-align:right;font-weight:700">${formatExact(purchase.amount, paid)}</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.7;color:#7a8194">
        Paid ${escapeHtml(paidOn)}<br>
        Reference ${escapeHtml(reference)}<br>
        ${escapeHtml(businessName)}
      </p>
    </div>

    ${upsell}

    <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#7a8194">
      Any trouble getting in, just reply to this email${
        settings?.replyTo ? ` (${escapeHtml(settings.replyTo)})` : ""
      } and we'll sort it.
    </p>
  </div>
</body></html>`;

  await sendTransactionalEmail({
    to: purchase.user.email,
    subject: `Your receipt & course access — ${purchase.course.title}`,
    html,
  });
}
