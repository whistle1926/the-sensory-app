import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { coursesAreaVisible } from "@/lib/storefront";
import { ImpersonationBanner } from "@/components/impersonate/impersonation-banner";
import { AccountMenu } from "@/components/account/account-menu";
import { PortalNav } from "@/components/portal/portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await auth();
  } catch (e: unknown) {
    if (e instanceof Error && "digest" in e) throw e;
    console.error("[PORTAL_LAYOUT] Auth error:", e);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-red-600">Session error. Please sign in again.</p>
          <Link href="/logout" className="text-blue-600 underline">
            Sign out and retry
          </Link>
        </div>
      </div>
    );
  }

  if (!session?.user) redirect("/login");

  const role = session.user.role;
  // Staff are kept out of the client portal by the middleware in
  // src/lib/auth.config.ts, which redirects SUPER_ADMIN/TEAM_MANAGER away
  // from every /portal path EXCEPT /portal/training/* — the "View as a
  // learner" course preview. Middleware runs on all pages (see
  // middleware.ts matcher), so by the time a staff user reaches this layout
  // they can only be on that preview route. Re-blocking them here would
  // undo the exception, so we don't. CLIENT access is unchanged.
  if (role !== "CLIENT" && role !== "SUPER_ADMIN" && role !== "TEAM_MANAGER") {
    redirect("/dashboard");
  }

  const name = session.user.name || session.user.email || "You";
  const isImpersonating = !!session.user.impersonatedBy;
  const showCourses = await coursesAreaVisible();

  return (
    <div className="sub flex min-h-screen flex-col">
      {isImpersonating && <ImpersonationBanner targetName={name} />}
      <header className="sticky top-0 z-20 border-b-[3px] border-[#12235B] bg-[#FFF8EC]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#12235B] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="sub-display hidden text-[20px] tracking-[-.4px] sm:inline">
              The Sensory Submarine
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <PortalNav coursesEnabled={showCourses} />
            <div className="ml-1">
              <AccountMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>

      <footer className="border-t-2 border-[#F2E4CD] py-6 text-center text-[13px] font-bold text-[#6B7794]">
        <p>The Sensory Submarine &middot; Occupational Therapy Services &middot; Northern Ireland</p>
      </footer>
    </div>
  );
}
