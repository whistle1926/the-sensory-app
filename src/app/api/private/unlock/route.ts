import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setUnlockCookie, verifyPin } from "@/lib/private-pin";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!pin) {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  if (!verifyPin(pin)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  await setUnlockCookie();
  return NextResponse.json({ ok: true });
}
