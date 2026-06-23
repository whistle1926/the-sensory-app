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
