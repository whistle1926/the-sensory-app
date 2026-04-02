import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Preview mode: use defaults if not logged in
  const userName = session?.user?.name || "Patrick Farren";
  const userRole = session?.user?.role || "SUPER_ADMIN";

  return (
    <div className="flex h-screen">
      <Sidebar role={userRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-white px-4 md:px-0 md:border-0">
          <MobileNav role={userRole} />
          <div className="flex-1">
            <Header userName={userName} userRole={userRole} />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
