import { auth } from "./auth";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(allowedRoles: Role[]) {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export function canAccessClient(userRole: Role, userId: string, client: { managerId?: string | null; parentId?: string | null }) {
  if (userRole === "SUPER_ADMIN") return true;
  if (userRole === "TEAM_MANAGER" && client.managerId === userId) return true;
  if (userRole === "CLIENT" && client.parentId === userId) return true;
  return false;
}
