import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearUnlockCookie } from "@/lib/private-pin";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  await clearUnlockCookie();
  return NextResponse.json({ ok: true });
}
