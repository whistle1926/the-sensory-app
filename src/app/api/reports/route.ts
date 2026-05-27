import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Staff-only list. Previously this route was unauthenticated AND
 * the global middleware excludes /api/* — so every report (with the
 * client's name attached) was readable by anyone hitting the URL.
 * Now requires a logged-in staff session; CLIENTs use the portal-
 * scoped routes instead.
 *
 * Scoped per role:
 *   SUPER_ADMIN   — sees every report
 *   TEAM_MANAGER  — sees reports for clients they manage
 *   CLIENT        — 403 (use /api/portal/...)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const where =
    session.user.role === "TEAM_MANAGER"
      ? { client: { managerId: session.user.id } }
      : {};

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  return NextResponse.json(reports);
}
