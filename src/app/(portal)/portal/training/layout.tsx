import { redirect } from "next/navigation";
import { coursesEnabled } from "@/lib/storefront";

/**
 * Gate for ALL portal course routes. Courses can be paused (storefront
 * "Courses" toggle off) while content isn't ready — when paused, a parent
 * who just created an account must not be able to reach any course page,
 * even by typing the URL directly. Hiding the nav link isn't enough; this
 * redirects every /portal/training/* route back to the portal home.
 */
export default async function PortalTrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await coursesEnabled())) {
    redirect("/portal");
  }
  return <>{children}</>;
}
