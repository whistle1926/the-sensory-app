/**
 * Read-only bank transfer details for any staff member — used by the
 * invoice detail page to render the "Pay by bank transfer" preview.
 * These are NOT secret (they print on invoices), so unlike the full
 * /api/settings/payment route this is readable by TEAM_MANAGER too.
 * Editing still happens only via /api/settings/payment (SUPER_ADMIN).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
    select: {
      bankAccountName: true,
      bankSortCode: true,
      bankAccountNumber: true,
      bankIban: true,
      bankBic: true,
      bankTransferInstructions: true,
    },
  });

  return NextResponse.json({
    bankAccountName: s?.bankAccountName ?? "",
    bankSortCode: s?.bankSortCode ?? "",
    bankAccountNumber: s?.bankAccountNumber ?? "",
    bankIban: s?.bankIban ?? "",
    bankBic: s?.bankBic ?? "",
    bankTransferInstructions: s?.bankTransferInstructions ?? "",
  });
}
