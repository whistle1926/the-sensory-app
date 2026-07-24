/**
 * AI tidy-pass for a progress note (before it's saved).
 *
 *   POST /api/clients/[clientId]/notes/tidy   body: { body: html }
 *   200: { body: tidiedHtml }
 *
 * Cleans up grammar/tone in the note's HTML without changing any clinical
 * content — the OT reviews and can undo before saving. Staff-only, and gated
 * to clients the requester can access, same as the notes routes.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { sanitizeRichText } from "@/lib/rich-text";
import { tidyProgressNote } from "@/lib/claude";

// A long dictated note can take a while to tidy; give headroom (Fluid
// Compute lifts the cap to 300s).
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await params;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { managerId: true, parentId: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!canAccessClient(session.user.role as never, session.user.id, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Same rationale as the report tidy — Anthropic calls are metered + slow.
  const blocked = rateLimitOrReject("note.tidy", session.user.id, {
    max: 6,
    windowMs: 5 * 60_000,
  });
  if (blocked) return blocked;

  const raw = (await req.json().catch(() => ({}))) as { body?: string };
  const html = typeof raw.body === "string" ? raw.body : "";
  if (!html.replace(/<[^>]+>/g, "").trim()) {
    return NextResponse.json({ error: "Nothing to tidy." }, { status: 400 });
  }

  try {
    const tidied = await tidyProgressNote(html);
    // Sanitise before returning — same treatment the note gets on save, so a
    // tidy can never introduce markup we wouldn't otherwise store.
    return NextResponse.json({ body: sanitizeRichText(tidied) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notes/tidy] Claude failure:", err);
    const hint = /api[_ ]?key/i.test(msg)
      ? "Claude API key issue — check Settings → AI."
      : /timeout|aborted/i.test(msg)
        ? "Claude took too long. Try again."
        : "Tidy failed. Try again, or save without tidying.";
    return NextResponse.json({ error: hint }, { status: 502 });
  }
}
