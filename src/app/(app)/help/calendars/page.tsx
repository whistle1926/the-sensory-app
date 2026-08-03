import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { googleOAuthConfigured } from "@/lib/google-calendar";
import { CalendarHelpContent } from "@/components/help/calendar-help-content";

export const dynamic = "force-dynamic";

/**
 * "How the calendars work" — a plain-English explainer for staff.
 *
 * The team kept getting caught out by the fact that there are TWO separate,
 * independent connections between the portal and Google, pointing in opposite
 * directions, and that neither is instant:
 *
 *   portal -> Google   a button in the New booking email (manual), unless
 *                      automatic sync is switched on for the site
 *   Google -> portal   the secret iCal feed: read-only and hours behind
 *
 * Doing one does NOT do the other. This page says so out loud rather than
 * leaving people to work it out. Sync status is read live from the
 * environment so the page can never claim something that isn't true.
 */
export default async function CalendarHelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Calendars are a staff feature — clients have no calendar to connect.
  if (session.user.role === "CLIENT") redirect("/portal");

  return <CalendarHelpContent autoSyncOn={googleOAuthConfigured()} />;
}
