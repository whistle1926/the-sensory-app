import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Only SUPER_ADMIN can reach anything under /private. PIN unlock is enforced
// page-by-page so /private/unlock itself stays reachable when locked.
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");
  return <>{children}</>;
}
