import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      business: true,
      dashTemplateId: true,
      createdAt: true,
      // Selected only to derive a boolean — the hash itself is never
      // returned to the client.
      passwordHash: true,
    },
    orderBy: { name: "asc" },
  });

  const users = rows.map(({ passwordHash, ...u }) => ({
    ...u,
    hasPassword: Boolean(passwordHash),
  }));

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Role gating:
  //   SUPER_ADMIN — can create any role (staff or client).
  //   TEAM_MANAGER — can create CLIENT-role users only (so they can
  //                  onboard parents/carers from /website-users) but
  //                  cannot escalate by minting other staff accounts.
  //   Anyone else — Forbidden.
  const actorRole = session.user.role;
  const requestedRole = parsed.data.role;
  if (actorRole !== "SUPER_ADMIN") {
    if (actorRole !== "TEAM_MANAGER" || requestedRole !== "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
      business: parsed.data.business,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
