import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCore } from "@/lib/currencies";

// Public read of enabled currencies for any authenticated user.
// Used by tax settings, invoice creation, client form, etc.
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
    select: { currencies: true },
  });

  const currencies = ensureCore(settings?.currencies ?? []);
  return NextResponse.json({ currencies });
}
