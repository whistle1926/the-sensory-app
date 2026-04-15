import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the lists needed by the "Assign to" and "Share with client" pickers:
 * - team: SUPER_ADMIN + TEAM_MANAGER users
 * - clients: CLIENT users that have a linked Client on this consultant's roster
 *            (SUPER_ADMIN sees all CLIENT users; TEAM_MANAGER sees only clients
 *            they manage).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const team = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "TEAM_MANAGER"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  const clientWhere =
    session.user.role === "SUPER_ADMIN"
      ? { role: "CLIENT" as const }
      : {
          role: "CLIENT" as const,
          parentOfClients: { some: { managerId: session.user.id } },
        };
  const clients = await prisma.user.findMany({
    where: clientWhere,
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ team, clients });
}
