// Step 3: add the Prisma query. If the page still renders, the crash must
// have been in a component (Toolbar / Panel / Chip). Strip the try/catch in
// a later step once we know what's happening.
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LiveSessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  let prismaError: string | null = null;
  let rowCount = 0;
  try {
    const rooms = await prisma.liveRoom.findMany({
      orderBy: [{ scheduledStart: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        mode: true,
        status: true,
        scheduledStart: true,
        _count: { select: { recordings: true } },
      },
    });
    rowCount = rooms.length;
  } catch (err: unknown) {
    prismaError =
      err instanceof Error ? `${err.name}: ${err.message}` : "prisma error";
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Live Sessions</h1>
      <p>Step 3 — auth + prisma.liveRoom.findMany.</p>
      <p style={{ marginTop: 12, fontSize: 14 }}>
        {prismaError ? (
          <span style={{ color: "#b91c1c" }}>PRISMA ERROR: {prismaError}</span>
        ) : (
          <>Found <strong>{rowCount}</strong> live rooms in the DB.</>
        )}
      </p>
    </div>
  );
}
