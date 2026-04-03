import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await params;
  const body = await req.json();
  const { status } = body;

  if (!status || !["confirmed", "cancelled", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });

  return NextResponse.json(booking);
}
