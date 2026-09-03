/**
 * AI tidy-pass for a letter body.
 *
 *   POST /api/letters/tidy   body: { html } → 200: { html }
 *
 * Mirrors the home-programme / report tidy: the therapist clicks "Tidy with
 * AI" while editing and we pass the IN-FLIGHT body (not the saved copy) to
 * Claude with a tight prompt — grammar/tone only, no clinical changes, and
 * [bracketed placeholders] left untouched. Nothing is persisted here; the
 * review step decides whether to apply it. Staff-only, rate-limited.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { tidyLetter } from "@/lib/claude";
import { sanitizeRichText } from "@/lib/rich-text";

export const maxDuration = 300;

const MAX_CHARS = 60_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blocked = rateLimitOrReject("letter.tidy", session.user.id, {
    max: 5,
    windowMs: 5 * 60_000,
  });
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const html = typeof body?.html === "string" ? body.html : "";

  if (!html.trim()) {
    return NextResponse.json(
      { error: "There's nothing to tidy yet — write the letter first." },
      { status: 400 },
    );
  }
  if (html.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "This letter is too long to tidy in one go." },
      { status: 400 },
    );
  }

  try {
    const tidied = sanitizeRichText(await tidyLetter(html));
    if (!tidied) {
      return NextResponse.json(
        { error: "The tidy came back empty — please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ html: tidied });
  } catch (err) {
    console.error("[letter-tidy]", err);
    return NextResponse.json(
      { error: "Couldn't tidy the letter just now. Please try again." },
      { status: 502 },
    );
  }
}
