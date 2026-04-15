import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ImpersonationBanner } from "@/components/impersonate/impersonation-banner";

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
  if (role !== "CLIENT") redirect("/dashboard");

  const name = session.user.name || session.user.email || "You";
  const initials = name
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isImpersonating = !!session.user.impersonatedBy;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {isImpersonating && <ImpersonationBanner targetName={name} />}
      <header className="border-b border-border/50 glass sticky top-0 z-20">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
                <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
                <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
                <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <span className="hidden text-base font-bold tracking-tight sm:inline">The Sensory Submarine</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/portal/bookings"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              My Bookings
            </Link>
            <Link
              href="/portal/training"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Training
            </Link>
            <Link
              href="/portal/feedback"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Feedback
            </Link>
            <Link
              href="/book"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Book
            </Link>
            <Link
              href="/logout"
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white ring-1 ring-primary/20 transition-transform hover:scale-105"
              title={`${name} — Sign out`}
            >
              {initials}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        <p>The Sensory Submarine &middot; Occupational Therapy Services &middot; Northern Ireland</p>
      </footer>
    </div>
  );
}
