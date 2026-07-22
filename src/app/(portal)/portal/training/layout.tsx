import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { coursesEnabled } from "@/lib/storefront";

/**
 * Gate for ALL portal course routes. Courses can be paused (storefront
 * "Courses" toggle off) while content isn't ready — when paused, a parent
 * who just created an account must not be able to reach any course page,
 * even by typing the URL directly. Hiding the nav link isn't enough; this
 * redirects every /portal/training/* route back to the portal home.
 *
 * STAFF are exempt: the pause exists to keep unreleased content away from
 * clients, not to stop the team checking their own work. Without this,
 * "View as a learner" (from Recordings) was dead whenever courses were
 * paused — which is exactly when you most want to preview a lesson.
 */
export default async function PortalTrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  const isStaff = role === "SUPER_ADMIN" || role === "TEAM_MANAGER";

  if (!isStaff && !(await coursesEnabled())) {
    redirect("/portal");
  }
  return <>{children}</>;
}
