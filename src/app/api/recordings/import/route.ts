/**
 * Manual backfill — pull the account's recent Zoom cloud recordings and start
 * a Vimeo upload for any we haven't seen before.
 *
 * The webhook handles everything going forward; this exists so existing
 * recordings (made before the integration was switched on) can be brought
 * across, and so a failed webhook can be retried by hand.
 *
 * Staff-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecentRecordings, zoomConfigured } from "@/lib/zoom";
import { ingestZoomRecording } from "@/lib/recording-sync";

export const maxDuration = 300;

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!zoomConfigured()) {
    return NextResponse.json(
      { error: "Zoom isn't connected yet — the account credentials are missing." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { days?: number };
  const days = Math.min(Math.max(body.days ?? 60, 1), 365);

  const meetings = await listRecentRecordings(days);
  if (meetings.length === 0) {
    return NextResponse.json({ found: 0, imported: 0 });
  }

  // Sequential on purpose: each ingest hits Zoom + Vimeo, and Vimeo rate-limits
  // uploads. A handful of recordings is the realistic volume here.
  let imported = 0;
  for (const m of meetings) {
    try {
      const before = m.uuid;
      const id = await ingestZoomRecording(m);
      if (id && before) imported++;
    } catch (err) {
      console.error("[recordings/import] failed for", m.uuid, err);
    }
  }

  return NextResponse.json({ found: meetings.length, imported });
}
