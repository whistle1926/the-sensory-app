/**
 * AI tidy-pass for a home programme body.
 *
 *   POST /api/home-programmes/tidy
 *     body: { html: string }
 *     200: { html: string }
 *
 * Mirrors the report tidy: the therapist clicks "Tidy with AI" while
 * editing and we pass the IN-FLIGHT body (not the saved copy) to Claude
 * with a tight prompt — grammar/tone only, no clinical changes. Nothing is
 * persisted here; the review dialog decides whether to apply it and the
 * normal Save writes it.
 *
 * Takes the body as text rather than an id so it works both on the
 * standalone Home Programmes page and inside the report editor (where the
 * programme may not be saved yet). Staff-only. Rate-limited.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { tidyHomeProgramme } from "@/lib/claude";
import { sanitizeRichText } from "@/lib/rich-text";

// A long programme can take a while to tidy; Fluid Compute lifts the cap
// to 300s, so give it headroom rather than risk a 504 (same as the report
// tidy route).
export const maxDuration = 300;

const MAX_CHARS = 60_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Anthropic calls are metered and slow — same budget as the report tidy.
  const blocked = rateLimitOrReject("home-programme.tidy", session.user.id, {
    max: 5,
    windowMs: 5 * 60_000,
  });
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const html = typeof body?.html === "string" ? body.html : "";

  if (!html.trim()) {
    return NextResponse.json(
      { error: "There's nothing to tidy yet — write or dictate some notes first." },
      { status: 400 },
    );
  }
  if (html.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "This programme is too long to tidy in one go." },
      { status: 400 },
    );
  }

  try {
    // Sanitise the model's HTML to the same allow-list the rich-text
    // editor uses, so the client only ever receives safe markup (the
    // preview renders it directly).
    const tidied = sanitizeRichText(await tidyHomeProgramme(html));
    if (!tidied) {
      return NextResponse.json(
        { error: "The tidy came back empty — please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ html: tidied });
  } catch (err) {
    console.error("[home-programme-tidy]", err);
    return NextResponse.json(
      { error: "Couldn't tidy the programme just now. Please try again." },
      { status: 502 },
    );
  }
}
