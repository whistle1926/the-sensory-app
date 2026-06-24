import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight client/parent typeahead for the manual booking form.
 * Matches on the child's name OR the parent/carer name/email and returns
 * the booker's name + email so a known family can be picked instead of
 * re-typed. Lives under /api/clients so the template-based access control
 * gates it (a restricted associate without client access gets 403 and the
 * form simply falls back to free text).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { role, id: userId } = session.user;
  // Mirror the list endpoint's visibility scoping.
  const scope =
    role === "SUPER_ADMIN" ? {} : { managerId: userId };

  const contains = { contains: q, mode: "insensitive" as const };
  const clients = await prisma.client.findMany({
    where: {
      ...scope,
      active: true,
      OR: [
        { firstName: contains },
        { lastName: contains },
        { parentCarerName: contains },
        { parentCarerEmail: contains },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentCarerName: true,
      parentCarerEmail: true,
    },
    orderBy: { lastName: "asc" },
    take: 8,
  });

  const results = clients.map((c) => ({
    id: c.id,
    childName: `${c.firstName} ${c.lastName}`.trim(),
    parentName: c.parentCarerName || "",
    parentEmail: c.parentCarerEmail || "",
  }));
  return NextResponse.json({ results });
}
