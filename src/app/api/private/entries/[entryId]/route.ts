import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/private-pin";

async function guard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 403 });
  }
  return null;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const denied = await guard();
  if (denied) return denied;

  const { entryId } = await params;
  const entry = await prisma.incomeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only allow deleting manual entries. Booking-sourced entries stay authoritative.
  if (entry.source !== "MANUAL") {
    return NextResponse.json(
      { error: "Only manual entries can be removed" },
      { status: 400 }
    );
  }

  await prisma.incomeEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
