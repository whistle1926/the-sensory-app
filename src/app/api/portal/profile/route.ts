import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Self-serve profile endpoint for CLIENT users (parents / carers).
 *
 *   GET  /api/portal/profile — current user's profile
 *   PATCH /api/portal/profile — update name and/or password
 *
 * Password changes require the current password. Name updates are
 * straightforward. Email is intentionally read-only here — a change would
 * require re-verification and is out of scope for self-serve.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: { name?: string; passwordHash?: string } = {};

  // Name update
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { error: "Name must be between 1 and 100 characters" },
        { status: 400 },
      );
    }
    data.name = name;
  }

  // Password update — requires current password unless the user still has
  // the placeholder hash (from a guest signup that hasn't set one yet).
  if ("newPassword" in body) {
    const newPassword = String(body.newPassword ?? "");
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hasRealPassword = current.passwordHash && current.passwordHash !== "!";
    if (hasRealPassword) {
      const currentPassword = String(body.currentPassword ?? "");
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 },
        );
      }
      const ok = await bcrypt.compare(currentPassword, current.passwordHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 },
        );
      }
    }

    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}
