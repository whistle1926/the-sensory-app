/**
 * Authorisation helpers for service-scoped booking management.
 *
 * Who can edit what:
 *   - SUPER_ADMIN  — any service's calendar, plus the global default
 *     calendar (serviceId = null) and service ownership.
 *   - TEAM_MANAGER — only the calendar of services they OWN. They
 *     cannot touch the global default or other associates' services.
 *   - CLIENT / anon — nothing.
 */
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

type Role = "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT";

export function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export interface ResolvedService {
  /** BookingService.id, or null when targeting the global default calendar. */
  serviceId: string | null;
  /** Owner of the resolved service (null for default / unassigned). */
  ownerId: string | null;
}

type ResolveResult =
  | ({ ok: true } & ResolvedService)
  | { ok: false; status: number; error: string };

/**
 * Resolve a `?service=<slug>` param to an id the caller is allowed to
 * manage, enforcing the ownership rules above. Pass `slug = null` to
 * target the global default calendar (SUPER_ADMIN only).
 */
export async function resolveManageableService(
  session: Session | null,
  slug: string | null,
): Promise<ResolveResult> {
  const role = session?.user?.role as Role | undefined;
  if (!session?.user) return { ok: false, status: 401, error: "Unauthorised" };
  if (!isStaff(role)) return { ok: false, status: 403, error: "Forbidden" };

  // Global default calendar — admin only.
  if (!slug) {
    if (role !== "SUPER_ADMIN") {
      return {
        ok: false,
        status: 403,
        error: "Choose one of your services to edit its availability.",
      };
    }
    return { ok: true, serviceId: null, ownerId: null };
  }

  const svc = await prisma.bookingService.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!svc) return { ok: false, status: 404, error: "Service not found" };

  if (role !== "SUPER_ADMIN" && svc.ownerId !== session.user.id) {
    return {
      ok: false,
      status: 403,
      error: "You can only edit availability for your own services.",
    };
  }

  return { ok: true, serviceId: svc.id, ownerId: svc.ownerId };
}
