import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "patrick@thesensorysubmarine.com" },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" });
    }

    const testPassword = "sensory2026";
    const valid = await bcrypt.compare(testPassword, user.passwordHash);

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.email,
      role: user.role,
      hashPrefix: user.passwordHash.substring(0, 10),
      passwordValid: valid,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      error: (error as Error).message,
    }, { status: 500 });
  }
}
