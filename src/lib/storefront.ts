import { prisma } from "@/lib/prisma";

/**
 * Whether courses are currently "live". This is the same flag the public
 * storefront uses to show/hide the Courses link (`showCoursesNav`). When
 * it's off, courses are paused everywhere — the public storefront AND the
 * logged-in portal — so a parent who just made an account can't reach
 * course content before it's ready. Defaults to true for legacy rows.
 */
export async function coursesEnabled(): Promise<boolean> {
  try {
    const row = await prisma.storefrontConfig.findUnique({
      where: { id: "default" },
      select: { showCoursesNav: true },
    });
    return row?.showCoursesNav ?? true;
  } catch {
    // If the lookup fails, fail OPEN only for legacy safety on the public
    // side — but for gating access we prefer to fail CLOSED. Callers that
    // gate access should treat a thrown/unknown state as "paused"; here we
    // return true only when we positively read true. A DB error returns
    // false so paused-by-default protects unreleased content.
    return false;
  }
}

/**
 * Individually-published courses.
 *
 * The `showCoursesNav` flag above is all-or-nothing, which was too blunt: the
 * three parent webinars are finished and ready to sell, but the other nine
 * courses are still being written. Marking a course `isLive` puts that ONE
 * course on sale while the rest of the catalogue stays hidden.
 *
 * So a course is reachable when EITHER the whole section is on, OR that
 * particular course is flagged live. Everything below fails closed on error.
 */
export async function anyCourseLive(): Promise<boolean> {
  try {
    const n = await prisma.course.count({
      where: { isLive: true, status: "AVAILABLE" },
    });
    return n > 0;
  } catch {
    return false;
  }
}

/** Should the Courses area be reachable at all — section on, or something live in it. */
export async function coursesAreaVisible(): Promise<boolean> {
  return (await coursesEnabled()) || (await anyCourseLive());
}

/** Can this specific course be viewed/bought right now? */
export async function courseAccessible(where: { id?: string; slug?: string }): Promise<boolean> {
  if (await coursesEnabled()) return true;
  if (!where.id && !where.slug) return false;
  try {
    const c = await prisma.course.findFirst({
      where: {
        ...(where.id ? { id: where.id } : {}),
        ...(where.slug ? { slug: where.slug } : {}),
        isLive: true,
        status: "AVAILABLE",
      },
      select: { id: true },
    });
    return !!c;
  } catch {
    return false;
  }
}

/**
 * Prisma `where` clause for listing courses publicly. With the section on this
 * is the normal "not archived" list; with it off, only the individually-live
 * ones. Callers spread this into their own where.
 */
export async function publicCourseWhere(): Promise<Record<string, unknown>> {
  if (await coursesEnabled()) return { status: { not: "ARCHIVED" } };
  return { isLive: true, status: "AVAILABLE" };
}

/** The heading shown above the individually-published courses. */
export interface LiveSectionConfig {
  enabled: boolean;
  title: string;
  blurb: string;
}

export async function liveSectionConfig(): Promise<LiveSectionConfig> {
  try {
    const row = await prisma.storefrontConfig.findUnique({
      where: { id: "default" },
      select: { liveSection: true },
    });
    const raw = (row?.liveSection ?? {}) as Partial<LiveSectionConfig>;
    return {
      enabled: raw.enabled !== false,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "Parent webinars",
      blurb:
        typeof raw.blurb === "string" && raw.blurb.trim()
          ? raw.blurb
          : "Watch back in your own time, as often as you like.",
    };
  } catch {
    return { enabled: true, title: "Parent webinars", blurb: "" };
  }
}
