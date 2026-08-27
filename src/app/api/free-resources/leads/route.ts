/**
 * Everyone who has asked for a download — the actual point of the exercise.
 * Consent is shown per row so it's obvious who may be emailed and who may not.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const leads = await prisma.resourceLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, email: true, name: true, marketingConsent: true, createdAt: true,
      resource: { select: { title: true } },
    },
  });
  return NextResponse.json(leads);
}
