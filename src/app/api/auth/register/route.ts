/**
 * Public self-serve registration for parents / carers.
 *
 *   POST /api/auth/register
 *     body: { name: string; email: string; password: string }
 *     201:  { ok: true; userId: string }
 *     400:  invalid input (zod)
 *     409:  email already in use
 *     429:  too many attempts from this IP
 *
 * Forces role = "CLIENT" — staff accounts are created from /team
 * by a Super Admin, never via this endpoint. After this returns
 * 201, the client-side page calls signIn() to drop the user
 * straight into the portal.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

function clientIpFromHeaders(req: NextRequest): string {
  // Same precedence the rest of the app uses for rate-limit keys —
  // x-forwarded-for first hop, then x-real-ip, then a coarse fallback.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "anon";
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}

export async function POST(req: NextRequest) {
  // Hard cap: 5 registrations per IP per hour. Generous for a real
  // family on a shared line, brutal for any scripted abuse.
  const ip = clientIpFromHeaders(req);
  const blocked = rateLimitOrReject("auth.register", ip, {
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid registration details." },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists. Try signing in instead." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "CLIENT",
    },
    select: { id: true, email: true },
  });

  // Audit the self-serve account creation so we have a record if
  // a family later disputes who opened the account.
  await recordAudit({
    actorId: user.id,
    actorLabel: `${name} <${email}> (self-registered)`,
    action: "user.create",
    targetType: "user",
    targetId: user.id,
    meta: { source: "public-register", role: "CLIENT" },
    req,
  });

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
}
