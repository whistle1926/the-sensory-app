import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await auth();
  } catch (e: unknown) {
    // Rethrow Next.js internal errors (DYNAMIC_SERVER_USAGE, etc.)
    if (e instanceof Error && "digest" in e) throw e;
    console.error("[LAYOUT] Auth error:", e);
    redirect("/login");
  }

  if (!session?.user) redirect("/login");

  const role = (session.user.role || "SUPER_ADMIN") as "SUPER_ADMIN" | "TEAM_MANAGER" | "CLIENT";

  return (
    <div className="flex h-screen">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-white px-4 md:px-0 md:border-0">
          <MobileNav role={role} />
          <div className="flex-1">
            <Header userName={session.user.name || "User"} userRole={role} />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
