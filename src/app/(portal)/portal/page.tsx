import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Portal home — smart redirect based on what the user actually has
 * going on. Enrolled in a course → training (so the course is front-
 * and-centre). Has an upcoming booking but no course → bookings.
 * Neither → training (it's the thing with the most content to browse).
 *
 * Hit when the user clicks the logo in the portal nav or lands on
 * /portal directly.
 */
export default async function PortalHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Active enrolment? Send them straight to the training hub so they
  // see "Continue learning" at the top.
  const enrolment = await prisma.enrollment.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (enrolment) redirect("/portal/training");

  // Otherwise: bookings page (their 1:1 sessions).
  redirect("/portal/bookings");
}
