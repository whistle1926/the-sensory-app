/**
 * Booking services catalogue.
 *
 *   GET   /api/booking-services             — public; powers the
 *                                              /book page and per-slug
 *                                              landing pages.
 *   POST  /api/booking-services             — staff; creates a new
 *                                              service. Slug + title
 *                                              required, everything
 *                                              else has sensible
 *                                              defaults.
 *
 * The public GET filters to `isActive = true`. Staff GET (via the
 * admin UI) sends `?all=1` to see archived rows for editing.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

/** Slugify a title for `BookingService.slug`. Same shape as the course
 * slug helper — kept local because the two products may diverge. */
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `service-${Date.now().toString(36)}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const all = req.nextUrl.searchParams.get("all") === "1";
  const showInactive = all && isStaff(session?.user?.role);

  const rows = await prisma.bookingService.findMany({
    where: showInactive ? {} : { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          bio: true,
          phone: true,
        },
      },
    },
  });
  // Flatten the owner relation for the public cards + admin list, while
  // keeping ownerId for the editor. The therapist profile fields are
  // surfaced so the booking page can show who runs each clinic.
  const shaped = rows.map(({ owner, ...svc }) => ({
    ...svc,
    ownerName: owner?.name ?? null,
    ownerPhotoUrl: owner?.photoUrl ?? null,
    ownerBio: owner?.bio ?? null,
    ownerPhone: owner?.phone ?? null,
  }));
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    slug?: string;
  };
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "New service";

  // Slug — accept user-supplied OR auto-generate. Retry on collision.
  let slug = (
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug
      : title
  )
    .toString();
  slug = slugify(slug);
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.bookingService.findUnique({
      where: { slug },
    });
    if (!exists) break;
    slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const last = await prisma.bookingService.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.bookingService.create({
    data: {
      slug,
      title,
      description: "",
      category: "",
      pricePence: 0,
      durationLabel: "60 minutes",
      durationMinutes: 60,
      isActive: false, // ship as draft so a half-made service isn't on /book
      order: (last?.order ?? -1) + 1,
    },
  });
  return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
}
