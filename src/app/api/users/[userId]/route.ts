import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

/** GET — a single user's profile (+ whether a password is set). SUPER_ADMIN only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      business: true,
      dashTemplateId: true,
      createdAt: true,
      passwordHash: true,
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { passwordHash, ...user } = row;
  return NextResponse.json({ ...user, hasPassword: Boolean(passwordHash) });
}

/** PATCH — update a user's dashboard template and/or reset their
 *  password (so an admin can test that a team member can sign in).
 *  SUPER_ADMIN only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  let passwordWasReset = false;

  // Admin-set password — hashed server-side, never stored or logged in
  // plaintext. Used to verify a team member can log in with known
  // credentials.
  if ("password" in body) {
    if (typeof body.password !== "string" || body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }
    data.passwordHash = await bcrypt.hash(body.password, 12);
    passwordWasReset = true;
  }

  // Display name.
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    data.name = body.name.trim().slice(0, 120);
  }

  // Login email — validate format + uniqueness (it's the sign-in id).
  let emailChanged = false;
  if ("email" in body) {
    if (typeof body.email !== "string") {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "That doesn't look like a valid email." }, { status: 400 });
    }
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== userId) {
      return NextResponse.json(
        { error: "Another account already uses that email." },
        { status: 409 },
      );
    }
    data.email = email;
    emailChanged = true;
  }

  if ("dashTemplateId" in body) {
    if (body.dashTemplateId !== null && typeof body.dashTemplateId !== "string") {
      return NextResponse.json(
        { error: "dashTemplateId must be a string or null" },
        { status: 400 }
      );
    }

    // Verify the template exists if a non-null value is provided.
    if (body.dashTemplateId !== null) {
      const template = await prisma.dashTemplate.findUnique({
        where: { id: body.dashTemplateId },
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
    }

    data.dashTemplateId = body.dashTemplateId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, role: true, dashTemplateId: true },
  });

  // Audit password resets — a sensitive action. We record who did it and
  // to whom, never the password itself.
  if (passwordWasReset) {
    await recordAudit({
      actorId: session.user.id,
      actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
      action: "user.password.reset",
      targetType: "user",
      targetId: userId,
      meta: { targetEmail: user.email, targetRole: user.role },
      req,
    });
  }
  // Email is the login identity — worth recording when it changes.
  if (emailChanged) {
    await recordAudit({
      actorId: session.user.id,
      actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
      action: "user.update",
      targetType: "user",
      targetId: userId,
      meta: { field: "email", newEmail: user.email },
      req,
    });
  }

  return NextResponse.json({ ...user, passwordReset: passwordWasReset });
}
