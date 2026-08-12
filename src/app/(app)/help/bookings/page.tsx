import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleOAuthConfigured } from "@/lib/google-calendar";
import {
  BookingsHelpContent,
  type BookingsSetupState,
} from "@/components/help/bookings-help-content";

export const dynamic = "force-dynamic";

/**
 * "How bookings and calendars work" — the walk-through Claire asked for.
 *
 * Deliberately not a static explainer. Nearly everything the team wants from
 * the booking system already exists, but it behaves as if it doesn't because
 * services have no owner and none of them have set their own hours — so they
 * all fall back to one shared schedule. A page that only described the
 * intended behaviour would read as untrue.
 *
 * So the setup state is read live and shown alongside the explanation: what
 * is meant to happen, and what is actually configured right now.
 */
export default async function BookingsHelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Bookings admin is staff-only; clients see their own appointments instead.
  if (session.user.role === "CLIENT") redirect("/portal");

  const [services, hoursServiceIds, dateOverrides, staffCount, calendarsConnected] =
    await Promise.all([
      prisma.bookingService.findMany({
        where: { isActive: true },
        select: { title: true, ownerId: true },
        orderBy: { order: "asc" },
      }),
      // NULL serviceId is the shared default schedule — not a service's own.
      prisma.weeklyHours.findMany({
        where: { serviceId: { not: null } },
        select: { serviceId: true },
        distinct: ["serviceId"],
      }),
      prisma.dateOverride.count(),
      prisma.user.count({ where: { role: { not: "CLIENT" } } }),
      prisma.user.count({
        where: { role: { not: "CLIENT" }, calendarIcsUrl: { not: null } },
      }),
    ]);

  const state: BookingsSetupState = {
    totalServices: services.length,
    servicesWithoutOwner: services.filter((s) => !s.ownerId).map((s) => s.title),
    servicesWithOwnHours: hoursServiceIds.length,
    dateOverrides,
    calendarsConnected,
    staffCount,
    googleSyncOn: googleOAuthConfigured(),
  };

  return <BookingsHelpContent state={state} />;
}
