import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      ok: true,
      userCount,
      dbUrl: process.env.DATABASE_URL?.replace(/:[^@]+@/, ":***@"),
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({
      ok: false,
      error: err.message,
      dbUrl: process.env.DATABASE_URL?.replace(/:[^@]+@/, ":***@"),
    }, { status: 500 });
  }
}
