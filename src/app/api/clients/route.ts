import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validators";
import { ensureParentAccount } from "@/lib/parent-account";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { role, id: userId } = session.user;

  const where =
    role === "SUPER_ADMIN"
      ? {}
      : role === "TEAM_MANAGER"
        ? { managerId: userId }
        : { parentId: userId };

  const clients = await prisma.client.findMany({
    where: { ...where, active: true },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // If a parent email is supplied, auto-link or create the parent User account
  let parentId: string | undefined;
  let parentAccountCreated = false;
  const parentEmail = parsed.data.parentCarerEmail?.trim();
  if (parentEmail) {
    try {
      const result = await ensureParentAccount({
        email: parentEmail,
        name: parsed.data.parentCarerName || parentEmail,
        origin: req.nextUrl.origin,
      });
      parentId = result.userId;
      parentAccountCreated = result.created;
    } catch (err) {
      console.error("Parent account linking failed:", err);
      // Continue without linking
    }
  }

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      dateOfBirth: new Date(parsed.data.dateOfBirth),
      managerId: session.user.role === "TEAM_MANAGER" ? session.user.id : undefined,
      parentId,
    },
  });

  return NextResponse.json({ ...client, parentAccountCreated }, { status: 201 });
}
