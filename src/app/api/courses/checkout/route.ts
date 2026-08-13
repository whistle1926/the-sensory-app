import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FireBuddy } from "@/lib/firebuddy";
import { ensureEnrollment } from "@/lib/course-enrollment";
import { isCurrency, priceIn, type Currency } from "@/lib/course-currency";
import { courseAccessible } from "@/lib/storefront";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

// Lightweight in-memory per-IP rate limit — good enough while we're on a
// single Vercel instance. Matches the pattern used by public form submit.
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_IN_WINDOW = 5;

function rateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (RECENT.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_IN_WINDOW) {
    return {
      ok: false,
      retryAfter: Math.ceil((arr[0] + WINDOW_MS - now) / 1000),
    };
  }
  arr.push(now);
  RECENT.set(key, arr);
  return { ok: true };
}

function ipFromRequest(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeToken(): string {
  return randomBytes(18).toString("base64url");
}

function baseUrl(req: NextRequest): string {
  const env =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/**
 * Hybrid checkout for the public course storefront.
 *   - Signed-in CLIENT → ignores posted email, uses their user id.
 *   - Guest → requires name + email; upserts a CLIENT account.
 *   - Free courses → enrol immediately, redirect to /portal/training/[courseId].
 *   - Paid courses → create CoursePurchase, call FireBuddy, return paymentUrl.
 *
 * Guest-created accounts get a placeholder bcrypt hash they can never log in
 * with — they must use the set-password link emailed to them. The email goes
 * out from the webhook on payment.paid, or from here on free-course enrol.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Honeypot — bots tend to fill a field named "website". Quietly 200 them.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const ip = ipFromRequest(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
    );
  }

  const courseId = typeof body?.courseId === "string" ? body.courseId : "";
  if (!courseId)
    return NextResponse.json({ error: "Course is required." }, { status: 400 });

  // Pull UTM bundle off the request body (sent by <BuyDialog>). All
  // fields optional and length-capped — we trust the field shape but
  // not the values.
  const utmBundle = (body?.utm ?? {}) as Record<string, unknown>;
  const utm = {
    utmSource: stringField(utmBundle.utmSource),
    utmMedium: stringField(utmBundle.utmMedium),
    utmCampaign: stringField(utmBundle.utmCampaign),
    utmContent: stringField(utmBundle.utmContent),
    utmTerm: stringField(utmBundle.utmTerm),
    referrer: stringField(utmBundle.referrer, 2000),
  };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { select: { id: true } } },
  });
  if (!course || course.status !== "AVAILABLE") {
    return NextResponse.json(
      { error: "This course isn't available." },
      { status: 404 },
    );
  }
  // Courses paused → only individually-published ones can be bought. Checked
  // here rather than up front because it depends on WHICH course: the parent
  // webinars are on sale while the rest of the catalogue is still being written.
  if (!(await courseAccessible({ id: course.id }))) {
    return NextResponse.json(
      { error: "Courses aren't available yet. Please check back soon." },
      { status: 403 },
    );
  }
  if (course.modules.length === 0) {
    return NextResponse.json(
      { error: "This course isn't ready yet — modules haven't been added." },
      { status: 400 },
    );
  }

  // Tick-box add-ons chosen on the checkout page. Each becomes its own
  // purchase row (so it grants its own enrolment and can be refunded on its
  // own) but they're all covered by one payment.
  const addonIds: string[] = Array.isArray(body?.addonCourseIds)
    ? body.addonCourseIds.filter((x: unknown): x is string => typeof x === "string").slice(0, 6)
    : [];

  // Which currency they're paying in. Fire settles like-for-like, so this
  // decides which of the practice's accounts the money can land in. Defaults
  // to sterling; a course with no euro price simply can't be bought in euro.
  const requested: Currency = isCurrency(body?.currency) ? body.currency : "GBP";
  const amount = priceIn(course, requested);
  if (amount === null) {
    return NextResponse.json(
      { error: "This course isn't sold in euro yet." },
      { status: 400 },
    );
  }

  // Only offer what this course actually lists, and only what's genuinely
  // purchasable in the chosen currency — a stale id in the list is ignored
  // rather than failing the whole checkout.
  const allowedAddonIds = addonIds.filter(
    (id) => id !== courseId && course.upsellCourseIds.includes(id),
  );
  const addons = allowedAddonIds.length
    ? (
        await prisma.course.findMany({
          where: { id: { in: allowedAddonIds }, status: "AVAILABLE" },
          select: { id: true, title: true, price: true, priceEur: true, modules: { select: { id: true } } },
        })
      ).filter((a) => a.modules.length > 0 && priceIn(a, requested) !== null)
    : [];

  // ── Resolve the buyer ────────────────────────────────────────────
  const session = await auth();
  let userId: string;
  let userEmail: string;
  let wasNewUser = false;

  if (session?.user?.id) {
    userId = session.user.id;
    userEmail = session.user.email ?? "";
  } else {
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";
    if (!rawName || !isEmail(rawEmail)) {
      return NextResponse.json(
        { error: "Please enter a name and a valid email address." },
        { status: 400 },
      );
    }
    const existing = await prisma.user.findUnique({
      where: { email: rawEmail.toLowerCase() },
    });
    if (existing) {
      // Staff / admin shouldn't accidentally buy under their own email with
      // no password check — ask them to sign in first.
      if (existing.role !== "CLIENT") {
        return NextResponse.json(
          {
            error:
              "This email is already used by a staff account. Please sign in first, then buy.",
          },
          { status: 409 },
        );
      }
      userId = existing.id;
      userEmail = existing.email;
    } else {
      // Placeholder hash — bcrypt.compare will reject any password against
      // this, so the only way into the account is the set-password email.
      const placeholder = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
      const created = await prisma.user.create({
        data: {
          name: rawName.slice(0, 120),
          email: rawEmail.toLowerCase(),
          role: "CLIENT",
          passwordHash: placeholder,
        },
      });
      userId = created.id;
      userEmail = created.email;
      wasNewUser = true;
    }
  }

  // ── Already enrolled? send them straight to the course ─────────
  const existingEnrol = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existingEnrol) {
    return NextResponse.json({
      redirect: `/portal/training/${courseId}`,
      alreadyEnrolled: true,
    });
  }

  // Anything they already have is silently dropped — nobody should be able
  // to pay twice for the same course by leaving a box ticked.
  const ownedIds = new Set(
    (
      await prisma.enrollment.findMany({
        where: { userId, courseId: { in: addons.map((a) => a.id) } },
        select: { courseId: true },
      })
    ).map((e) => e.courseId),
  );
  const paidAddons = addons
    .filter((a) => !ownedIds.has(a.id))
    .map((a) => ({ id: a.id, title: a.title, amount: priceIn(a, requested)! }));

  const total = amount + paidAddons.reduce((sum, a) => sum + a.amount, 0);

  // ── Free course → enrol immediately ─────────────────────────────
  if (total === 0) {
    await ensureEnrollment(userId, courseId);
    for (const a of paidAddons) await ensureEnrollment(userId, a.id);

    if (wasNewUser) {
      await sendSetPasswordEmail({
        userId,
        email: userEmail,
        courseTitle: course.title,
        courseId,
        origin: baseUrl(req),
      });
      return NextResponse.json({
        ok: true,
        wasNewUser: true,
        checkEmail: true,
      });
    }
    return NextResponse.json({
      ok: true,
      redirect: `/portal/training/${courseId}`,
    });
  }

  // ── Paid course → create purchase + FireBuddy session ──────────
  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });
  if (!paymentSettings?.enabled || !paymentSettings.apiKey) {
    return NextResponse.json(
      {
        error:
          "Payments aren't configured yet. Please contact the practice to complete your purchase.",
      },
      { status: 503 },
    );
  }

  // One row per course so each grants its own enrolment and can be refunded
  // separately; a shared groupId ties them to the single payment.
  const groupId = paidAddons.length ? randomUUID() : null;
  const purchase = await prisma.coursePurchase.create({
    data: {
      userId,
      courseId,
      amount,
      paymentStatus: "pending",
      currency: requested,
      groupId,
      ...utm,
    },
  });
  for (const a of paidAddons) {
    await prisma.coursePurchase.create({
      data: {
        userId,
        courseId: a.id,
        amount: a.amount,
        paymentStatus: "pending",
        currency: requested,
        groupId,
        ...utm,
      },
    });
  }

  try {
    const fb = new FireBuddy(paymentSettings.apiKey);
    const origin = baseUrl(req);
    const description = paidAddons.length
      ? `${course.title} + ${paidAddons.length} more`
      : `${course.title} — CPD course`;
    const payment = await fb.createPayment({
      amount: total,
      currency: requested,
      description,
      // A group is settled as one payment; the webhook fans it back out.
      reference: groupId ? `courseGroup:${groupId}` : `course:${purchase.id}`,
      email: userEmail,
      returnUrl: `${origin}/courses/thanks?purchase=${purchase.id}`,
    });

    // Every row of the group carries the Fire code now that paymentRef is
    // no longer unique — it's the reference a human will quote.
    await prisma.coursePurchase.updateMany({
      where: groupId ? { groupId } : { id: purchase.id },
      data: { paymentRef: payment.code },
    });

    return NextResponse.json({
      paymentUrl: payment.paymentUrl,
      purchaseId: purchase.id,
      wasNewUser,
    });
  } catch (err) {
    console.error("[courses/checkout] FireBuddy failed:", err);
    await prisma.coursePurchase.updateMany({
      where: groupId ? { groupId } : { id: purchase.id },
      data: { paymentStatus: "failed" },
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}

/**
 * Fire off the set-password email for a guest who just enrolled on a free
 * course. For paid courses this is invoked from the FireBuddy webhook once
 * payment is confirmed.
 */
async function sendSetPasswordEmail(opts: {
  userId: string;
  email: string;
  courseTitle: string;
  courseId: string;
  origin: string;
}) {
  const token = makeToken();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  await prisma.passwordSetupToken.create({
    data: {
      userId: opts.userId,
      token,
      expiresAt: expires,
    },
  });

  const url = `${opts.origin}/set-password?token=${token}`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 16px;font-size:20px">You're in!</h1>
      <p style="font-size:14px;color:#333;line-height:1.6">
        Welcome to <strong>${escapeHtml(opts.courseTitle)}</strong>. Set a
        password to access your course any time.
      </p>
      <div style="margin-top:20px">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Set your password
        </a>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#888">
        This link expires in 14 days. If the button doesn't work, paste this URL into your browser:<br/>
        ${escapeHtml(url)}
      </p>
    </div>
  </body></html>`;

  try {
    await sendTransactionalEmail({
      to: opts.email,
      subject: `Set your password — ${opts.courseTitle}`,
      html,
    });
  } catch (err) {
    console.error("[courses/checkout] set-password email failed:", err);
  }
}

/** Coerce a JSON-body field into an optional trimmed string. Returns
 * undefined on null/empty/non-string so the Prisma row gets a clean
 * NULL rather than an empty string. */
function stringField(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}
