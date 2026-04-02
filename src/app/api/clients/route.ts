import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validators";

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

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      dateOfBirth: new Date(parsed.data.dateOfBirth),
      managerId: session.user.role === "TEAM_MANAGER" ? session.user.id : undefined,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
