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
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TAGLINE = 200;
const MAX_TITLE = 240;
const MAX_BLURB = 1_000;

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
    showCoursesNav: row?.showCoursesNav ?? true,
    showSignIn: row?.showSignIn ?? true,
    showCreateAccount: row?.showCreateAccount ?? true,
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
    showCoursesNav?: boolean;
    showSignIn?: boolean;
    showCreateAccount?: boolean;
  };

  const tagline = trimOrNull(body.tagline, MAX_TAGLINE);
  const heroTitle = trimOrNull(body.heroTitle, MAX_TITLE);
  const heroBlurb = trimOrNull(body.heroBlurb, MAX_BLURB);

  // Coerce only proper booleans — anything else falls back to the
  // existing value (or to visible-by-default on create).
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
      ...(showCoursesNav !== undefined && { showCoursesNav }),
      ...(showSignIn !== undefined && { showSignIn }),
      ...(showCreateAccount !== undefined && { showCreateAccount }),
    },
    create: {
      id: "default",
      tagline,
      heroTitle,
      heroBlurb,
      showCoursesNav: showCoursesNav ?? true,
      showSignIn: showSignIn ?? true,
      showCreateAccount: showCreateAccount ?? true,
    },
  });

  return NextResponse.json({
    tagline: row.tagline ?? "",
    heroTitle: row.heroTitle ?? "",
    heroBlurb: row.heroBlurb ?? "",
    showCoursesNav: row.showCoursesNav,
    showSignIn: row.showSignIn,
    showCreateAccount: row.showCreateAccount,
  });
}

/** Empty string → null so the column stays clean. */
function trimOrNull(v: string | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}
