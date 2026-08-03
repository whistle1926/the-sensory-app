/**
 * Settings → Storefront. Stores admin-editable hero copy for /courses
 * plus visibility toggles for the public header / footer links.
 * Singleton row keyed by id="default" — same pattern as
 * EmailSettings / TrackingSettings.
 *
 * GET is allowed unauthenticated because the public storefront also
 * reads from here. POST is staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanPartnerCourse } from "@/lib/partner-course";

const MAX_TAGLINE = 200;
const MAX_TITLE = 240;
const MAX_BLURB = 1_000;
const MAX_QUOTE = 600;
const MAX_NAME = 120;
const MAX_TESTIMONIALS = 12;

interface Testimonial {
  quote: string;
  author: string;
  meta?: string;
}

/** Coerce arbitrary JSON into a clean, capped testimonials array. */
function cleanTestimonials(raw: unknown): Testimonial[] {
  if (!Array.isArray(raw)) return [];
  const out: Testimonial[] = [];
  for (const item of raw.slice(0, MAX_TESTIMONIALS)) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const quote = typeof t.quote === "string" ? t.quote.trim().slice(0, MAX_QUOTE) : "";
    const author = typeof t.author === "string" ? t.author.trim().slice(0, MAX_NAME) : "";
    if (!quote) continue; // a testimonial with no quote is meaningless
    const meta = typeof t.meta === "string" ? t.meta.trim().slice(0, MAX_NAME) : "";
    out.push({ quote, author, ...(meta ? { meta } : {}) });
  }
  return out;
}

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET() {
  const row = await prisma.storefrontConfig.findUnique({
    where: { id: "default" },
  });
  return NextResponse.json({
    tagline: row?.tagline ?? "",
    heroTitle: row?.heroTitle ?? "",
    heroBlurb: row?.heroBlurb ?? "",
    // Default to visible for legacy rows that pre-date these
    // columns (Prisma fills the DB default at insert time, but a
    // missing row entirely would also short-circuit to the
    // null-coalescing branch). All-visible matches the original
    // behaviour, so a misconfigured row never hides links by
    // accident.
    showHomeNav: row?.showHomeNav ?? true,
    showCoursesNav: row?.showCoursesNav ?? true,
    showSignIn: row?.showSignIn ?? true,
    showCreateAccount: row?.showCreateAccount ?? true,
    testimonials: cleanTestimonials(row?.testimonials),
    partnerCourse: cleanPartnerCourse(row?.partnerCourse),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    tagline?: string;
    heroTitle?: string;
    heroBlurb?: string;
    showHomeNav?: boolean;
    showCoursesNav?: boolean;
    showSignIn?: boolean;
    showCreateAccount?: boolean;
    testimonials?: unknown;
    partnerCourse?: unknown;
  };

  // Only replace testimonials when the field is present, so a save from a
  // form that doesn't include them can't wipe them.
  const testimonials =
    "testimonials" in body ? cleanTestimonials(body.testimonials) : undefined;
  // Same guard for the partner-course card.
  const partnerCourse =
    "partnerCourse" in body ? cleanPartnerCourse(body.partnerCourse) : undefined;

  const tagline = trimOrNull(body.tagline, MAX_TAGLINE);
  const heroTitle = trimOrNull(body.heroTitle, MAX_TITLE);
  const heroBlurb = trimOrNull(body.heroBlurb, MAX_BLURB);

  // Coerce only proper booleans — anything else falls back to the
  // existing value (or to visible-by-default on create).
  const showHomeNav =
    typeof body.showHomeNav === "boolean" ? body.showHomeNav : undefined;
  const showCoursesNav =
    typeof body.showCoursesNav === "boolean" ? body.showCoursesNav : undefined;
  const showSignIn =
    typeof body.showSignIn === "boolean" ? body.showSignIn : undefined;
  const showCreateAccount =
    typeof body.showCreateAccount === "boolean" ? body.showCreateAccount : undefined;

  const row = await prisma.storefrontConfig.upsert({
    where: { id: "default" },
    update: {
      tagline,
      heroTitle,
      heroBlurb,
      ...(showHomeNav !== undefined && { showHomeNav }),
      ...(showCoursesNav !== undefined && { showCoursesNav }),
      ...(showSignIn !== undefined && { showSignIn }),
      ...(showCreateAccount !== undefined && { showCreateAccount }),
      ...(testimonials !== undefined && { testimonials: testimonials as unknown as Prisma.InputJsonValue }),
      ...(partnerCourse !== undefined && { partnerCourse: partnerCourse as unknown as Prisma.InputJsonValue }),
    },
    create: {
      id: "default",
      tagline,
      heroTitle,
      heroBlurb,
      showHomeNav: showHomeNav ?? true,
      showCoursesNav: showCoursesNav ?? true,
      showSignIn: showSignIn ?? true,
      showCreateAccount: showCreateAccount ?? true,
      ...(testimonials !== undefined && { testimonials: testimonials as unknown as Prisma.InputJsonValue }),
      ...(partnerCourse !== undefined && { partnerCourse: partnerCourse as unknown as Prisma.InputJsonValue }),
    },
  });

  return NextResponse.json({
    tagline: row.tagline ?? "",
    heroTitle: row.heroTitle ?? "",
    heroBlurb: row.heroBlurb ?? "",
    showHomeNav: row.showHomeNav,
    showCoursesNav: row.showCoursesNav,
    showSignIn: row.showSignIn,
    showCreateAccount: row.showCreateAccount,
    testimonials: cleanTestimonials(row.testimonials),
    partnerCourse: cleanPartnerCourse(row.partnerCourse),
  });
}

/** Empty string → null so the column stays clean. */
function trimOrNull(v: string | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}
