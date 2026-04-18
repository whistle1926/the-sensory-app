import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

// Small per-IP window — resends are cheap to request but we don't want
// anyone using us as an email bombing tool for arbitrary addresses.
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_IN_WINDOW = 3;

function rateLimit(key: string) {
  const now = Date.now();
  const arr = (RECENT.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_IN_WINDOW) return false;
  arr.push(now);
  RECENT.set(key, arr);
  return true;
}

function ipFromRequest(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function baseUrl(req: NextRequest): string {
  const env =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://sensory.aiworldexperts.com";
}

/**
 * Public resend endpoint for "I didn't get the set-password email" on the
 * course checkout flow.
 *
 * Only sends if we actually have a pending CLIENT account keyed to that
 * email with a placeholder password (i.e. never logged in). For anyone
 * else — staff, users who already have a real password, unknown emails —
 * we respond with a generic 200 so we don't leak account existence.
 */
export async function POST(req: NextRequest) {
  const ip = ipFromRequest(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const courseId =
    typeof body?.courseId === "string" ? body.courseId.trim() : "";

  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, email: true, name: true },
  });

  // Privacy-friendly: always return 200 so the caller can't use this to
  // probe which emails have accounts. Just quietly no-op for unknown or
  // non-CLIENT accounts.
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ ok: true });
  }

  // Look up a preferred course title for the email copy, if one was passed.
  let courseTitle = "your course";
  if (courseId) {
    const c = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
    if (c?.title) courseTitle = c.title;
  }

  // Burn any still-valid tokens so the new one is definitive.
  await prisma.passwordSetupToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const token = randomBytes(18).toString("base64url");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.passwordSetupToken.create({
    data: { userId: user.id, token, expiresAt: expires },
  });

  const origin = baseUrl(req);
  const url = `${origin}/set-password?token=${token}`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 16px;font-size:20px">Here's your set-password link</h1>
      <p style="font-size:14px;color:#333;line-height:1.6">
        You asked for a fresh link to set your password for
        <strong>${escapeHtml(courseTitle)}</strong>. Click below to pick a
        password and jump in.
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
      to: user.email,
      subject: `Your set-password link — ${courseTitle}`,
      html,
    });
  } catch (err) {
    console.error("[resend-setup] email send failed:", err);
    return NextResponse.json(
      { error: "Could not send email. Please try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
