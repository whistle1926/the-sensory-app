import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const email = (session.user.email || "").toLowerCase().trim();
  if (!email) return NextResponse.json({ bookings: [] });

  const bookings = await prisma.booking.findMany({
    where: { clientEmail: email },
    orderBy: { date: "desc" },
    select: {
      id: true,
      service: true,
      date: true,
      time: true,
      duration: true,
      price: true,
      status: true,
      paymentStatus: true,
    },
  });

  return NextResponse.json({ bookings });
}
