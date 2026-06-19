import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UpdateBanner } from "@/components/layout/update-banner";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await auth();
  } catch (e: unknown) {
    // Rethrow Next.js internal errors (DYNAMIC_SERVER_USAGE, redirects, etc.)
    if (e instanceof Error && "digest" in e) throw e;
    console.error("[LAYOUT] Auth error:", e);
    // Show error fallback instead of crashing
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600">Session error. Please sign in again.</p>
          <Link href="/logout" className="text-blue-600 underline">Sign out and retry</Link>
        </div>
      </div>
    );
  }

  if (!session?.user) redirect("/login");

  const role = (session.user.role || "SUPER_ADMIN") as "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT";

  // ── Resolve nav visibility from the user's dash template ──────
  let allowedNavKeys: string[] | null = null; // null = show everything (no template restriction)
  let navOrder: string[] = [];

  try {
    // Fetch user template, default template, and the user's nav order in parallel.
    const [user, defaultTemplate] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          dashTemplate: { select: { widgets: true } },
          navOrder: true,
        },
      }),
      prisma.dashTemplate.findFirst({
        where: { isDefault: true },
        select: { widgets: true },
      }),
    ]);

    const template = user?.dashTemplate || defaultTemplate;
    if (template) {
      allowedNavKeys = template.widgets.filter((w: string) => w.startsWith("nav_"));
    }
    if (user?.navOrder) navOrder = user.navOrder;
  } catch {
    // If DB fails, show all nav — don't lock the user out
  }

  return (
    <div className="flex h-screen">
      <Sidebar role={role} allowedNavKeys={allowedNavKeys} navOrder={navOrder} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <UpdateBanner />
        <div className="flex items-center gap-2 px-4 md:px-0">
          <MobileNav role={role} allowedNavKeys={allowedNavKeys} />
          <div className="flex-1">
            <Header userName={session.user.name || "User"} userRole={role} />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto scroll-smooth bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
