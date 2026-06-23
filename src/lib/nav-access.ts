import { prisma } from "./prisma";

/**
 * The nav permission keys a user has, derived from their dashboard
 * template (or the default template). Returns null when no template
 * applies — meaning "no restriction" (full access), so existing staff
 * and any mis-config fail OPEN rather than locking people out. A
 * restricted template (e.g. "Clinic Associate") returns only its keys,
 * which is what enforces the lockdown.
 *
 * Node-only (uses Prisma). Computed at login and stamped into the JWT.
 */
export async function computeNavAccess(
  dashTemplateId: string | null,
): Promise<string[] | null> {
  try {
    let tpl = dashTemplateId
      ? await prisma.dashTemplate.findUnique({
          where: { id: dashTemplateId },
          select: { widgets: true },
        })
      : null;
    if (!tpl) {
      tpl = await prisma.dashTemplate.findFirst({
        where: { isDefault: true },
        select: { widgets: true },
      });
    }
    const nav = (tpl?.widgets ?? []).filter((w) => w.startsWith("nav_"));
    return nav.length ? nav : null;
  } catch {
    return null; // fail open — never lock a user out on a transient error
  }
}
