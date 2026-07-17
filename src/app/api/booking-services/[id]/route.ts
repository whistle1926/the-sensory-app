/**
 * Single booking service — PATCH + DELETE for the admin editor.
 *
 * Note: DELETE refuses if the service has any existing Booking rows
 * pointing at its slug — archiving (isActive=false) is the safer way
 * to retire a service without losing the booking history that
 * references it.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t)
      return NextResponse.json(
        { error: "Title can't be empty." },
        { status: 400 },
      );
    data.title = t.slice(0, 200);
  }
  if (typeof body.description === "string")
    data.description = body.description.trim().slice(0, 5_000);
  if ("tagline" in body) {
    if (body.tagline === null) data.tagline = null;
    else if (typeof body.tagline === "string")
      data.tagline = body.tagline.trim().slice(0, 240) || null;
  }
  if (typeof body.category === "string")
    data.category = body.category.trim().slice(0, 120);
  if (typeof body.pricePence === "number" && Number.isFinite(body.pricePence))
    data.pricePence = Math.max(0, Math.floor(body.pricePence));
  if (typeof body.durationLabel === "string")
    data.durationLabel = body.durationLabel.trim().slice(0, 120);
  if (
    typeof body.durationMinutes === "number" &&
    Number.isFinite(body.durationMinutes)
  )
    data.durationMinutes = Math.max(0, Math.floor(body.durationMinutes));
  if (
    typeof body.depositPence === "number" &&
    Number.isFinite(body.depositPence)
  )
    data.depositPence = Math.max(0, Math.floor(body.depositPence));
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.autoSendReferralForm === "boolean")
    data.autoSendReferralForm = body.autoSendReferralForm;

  // How many dates the client picks in one booking (1/1 = a normal
  // appointment; 2/5 = a block priced per session).
  if (typeof body.minSessions === "number" && Number.isFinite(body.minSessions))
    data.minSessions = Math.min(20, Math.max(1, Math.floor(body.minSessions)));
  if (typeof body.maxSessions === "number" && Number.isFinite(body.maxSessions))
    data.maxSessions = Math.min(20, Math.max(1, Math.floor(body.maxSessions)));
  {
    const min = (data.minSessions ?? undefined) as number | undefined;
    const max = (data.maxSessions ?? undefined) as number | undefined;
    if (min !== undefined && max !== undefined && max < min) {
      return NextResponse.json(
        { error: "Max sessions can't be lower than min sessions." },
        { status: 400 },
      );
    }
  }
  if (typeof body.order === "number" && Number.isFinite(body.order))
    data.order = Math.floor(body.order);

  // Delivery mode — drives location/online wording. Any staff may set it.
  if (typeof body.mode === "string") {
    const m = body.mode.trim();
    if (!["in_person", "online", "home"].includes(m)) {
      return NextResponse.json(
        { error: "Mode must be in_person, online, or home." },
        { status: 400 },
      );
    }
    data.mode = m;
  }
  if ("locationLabel" in body) {
    if (body.locationLabel === null) data.locationLabel = null;
    else if (typeof body.locationLabel === "string")
      data.locationLabel = body.locationLabel.trim().slice(0, 120) || null;
  }

  // Owner assignment is SUPER_ADMIN-only — associates manage availability,
  // not who a service belongs to. Validate the target is a staff member.
  if ("ownerId" in body) {
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only an admin can assign a service owner." },
        { status: 403 },
      );
    }
    if (body.ownerId === null || body.ownerId === "") {
      data.ownerId = null;
    } else if (typeof body.ownerId === "string") {
      const owner = await prisma.user.findUnique({
        where: { id: body.ownerId },
        select: { role: true },
      });
      if (!owner || owner.role === "CLIENT") {
        return NextResponse.json(
          { error: "Owner must be a staff member." },
          { status: 400 },
        );
      }
      data.ownerId = body.ownerId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.bookingService.update({
    where: { id },
    data,
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const svc = await prisma.bookingService.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!svc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refuse if any historical bookings reference this slug — orphaning
  // them would break order lookups, refund flows, etc.
  const inUse = await prisma.booking.count({ where: { service: svc.slug } });
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `${inUse} existing booking${inUse === 1 ? "" : "s"} use this service — archive it instead (toggle 'Active' off) to preserve history.`,
      },
      { status: 409 },
    );
  }

  await prisma.bookingService.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
