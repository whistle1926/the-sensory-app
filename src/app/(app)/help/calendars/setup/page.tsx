import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CalendarSetupContent } from "@/components/help/calendar-setup-content";

export const dynamic = "force-dynamic";

/**
 * Click-by-click walkthrough for connecting a personal Google Calendar.
 *
 * Separate from /help/calendars (which explains the concepts) because the two
 * jobs are different: that page is "what is going on", this one is "do this,
 * then this". The instructions used to live collapsed inside a <details> on
 * the Settings page, where nobody found them.
 */
export default async function CalendarSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  // The screenshot of Settings → Calendar is stored as a help asset so it can
  // be re-captured without a deploy.
  const asset = await prisma.storefrontConfig.findUnique({
    where: { id: "default" },
    select: { helpAssets: true },
  });
  const assets = (asset?.helpAssets ?? {}) as Record<string, unknown>;
  const shot =
    typeof assets.calendarSettings === "string" ? assets.calendarSettings : undefined;

  return <CalendarSetupContent settingsScreenshotUrl={shot} />;
}
