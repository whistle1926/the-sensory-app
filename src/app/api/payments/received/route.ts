import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFirePaymentsReceived } from "@/lib/fire-payments";

// Live read from Fire — never cache.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Payments actually received in the Fire account, matched to invoices.
 * Read-only mirror of Fire's real transactions — the portal never writes
 * payment status. Staff-only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await getFirePaymentsReceived();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
