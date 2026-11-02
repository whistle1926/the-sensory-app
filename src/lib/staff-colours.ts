/**
 * One colour per staff member, shared by the team calendar and the clients
 * list so Grace sees the same person in the same colour everywhere.
 * A colour set on the person (calendarColour) wins; otherwise it comes from
 * their place in the staff list (oldest first, so it stays stable).
 */
import { prisma } from "@/lib/prisma";

export const STAFF_PALETTE = [
  // Strong, clearly different hues — events are drawn as solid blocks in
  // these colours, so neighbours in the list mustn't look alike.
  "#2563eb", // blue
  "#059669", // green
  "#d97706", // amber
  "#db2777", // pink
  "#ea580c", // orange
  "#7c3aed", // purple
  "#0891b2", // cyan
  "#65a30d", // lime
];

export function staffColourMap(
  staff: Array<{ id: string; calendarColour: string | null }>,
): Map<string, string> {
  return new Map(
    staff.map((u, idx) => [u.id, u.calendarColour ?? STAFF_PALETTE[idx % STAFF_PALETTE.length]]),
  );
}

/** Staff in palette order — the same list the team calendar colours from. */
export const STAFF_WHERE = {
  role: { in: ["SUPER_ADMIN", "TEAM_MANAGER"] as ("SUPER_ADMIN" | "TEAM_MANAGER")[] },
  isAutomation: false,
};

export async function loadStaffColours(): Promise<Map<string, string>> {
  const staff = await prisma.user.findMany({
    where: STAFF_WHERE,
    select: { id: true, calendarColour: true },
    orderBy: { createdAt: "asc" },
  });
  return staffColourMap(staff);
}
