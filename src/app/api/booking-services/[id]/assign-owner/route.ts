import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStaffAccount } from "@/lib/staff-account";

/**
 * Create-and-assign a therapist to a booking service in one step.
 *
 * Behind the "Add a new therapist" control in the service editor:
 * admin types a name + email, we find-or-create the staff login (with a
 * password-setup email so the therapist sets their own password), then
 * set them as this service's owner. Admin can then toggle the service
 * Active to take it live — no developer round-trip needed.
 *
 * SUPER_ADMIN only (ownership changes are admin-gated, same as PATCH).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json(
      { error: "Only an admin can add a therapist." },
      { status: 403 },
    );

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
  };
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 },
    );

  // Confirm the service exists before we mint an account for it.
  const service = await prisma.bookingService.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!service)
    return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const result = await ensureStaffAccount({
    email,
    name,
    origin: req.nextUrl.origin,
  });

  if (result.conflict === "client") {
    return NextResponse.json(
      {
        error:
          "That email already belongs to a parent/carer account. Use a different email for the therapist's staff login.",
      },
      { status: 409 },
    );
  }

  await prisma.bookingService.update({
    where: { id },
    data: { ownerId: result.userId },
  });

  return NextResponse.json({
    ok: true,
    ownerId: result.userId,
    ownerName: name,
    created: result.created,
    emailSent: result.emailSent,
  });
}
