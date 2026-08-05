/**
 * Make a cover image for a course from its own content.
 *
 * Claude turns the course copy into an illustration prompt, Flux draws it, and
 * the result is re-hosted to our own blob storage — Replicate's URLs are
 * temporary, so persisting one would leave a broken image later.
 *
 * The prompt rules matter for a paediatric practice: illustration only, never
 * a photo-real child, no text baked into the image (it would be unreadable at
 * card size and impossible to correct), and nothing identifying.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createMessageResilient,
  getAnthropicClient,
  recordAiLatency,
} from "@/lib/ai-model";
import { runFluxSchnell } from "@/lib/replicate";
import { rehostToBlob } from "@/lib/blob-upload";

// Claude + Flux + re-host: comfortably longer than a default invocation.
export const maxDuration = 300;

const STYLE =
  "children's book illustration, flat cartoon style, soft warm colours, " +
  "simple uncluttered background, no text, no words, no letters, no logos, " +
  "no photorealism, no identifiable faces";

const SYSTEM = `You write image-generation prompts for a paediatric occupational therapy practice.

Given a course's title and description, write ONE short Flux prompt for a friendly cover illustration that suits it.

Rules:
- Describe a simple, warm scene a parent would associate with the topic. One or two child characters at most, or none at all if an object-based scene works better.
- Never describe a real person, a brand, a logo, or anything identifying.
- Never ask for text, words, letters or numbers in the image.
- Never depict distress, restraint, medical procedures or anything clinical-looking.
- Keep it under 40 words.

Return ONLY the prompt text. No JSON, no quotes, no explanation.`;

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, description: true, shortDescription: true, copyNotes: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
  const kind = body.kind === "thumbnail" ? "thumbnail" : "hero";

  const source = [course.title, course.shortDescription, course.description, course.copyNotes]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2_000);
  if (source.trim().length < 10) {
    return NextResponse.json(
      { error: "Add a title and a description first — the picture is drawn from them." },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  let ok = false;
  try {
    // Step 1 — Claude turns the course copy into a drawing brief.
    const anthropic = await getAnthropicClient();
    const { message } = await createMessageResilient(anthropic, {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: source }],
    });
    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("No prompt from Claude");
    const scene = block.text.trim().replace(/^["']|["']$/g, "").slice(0, 400);

    // Shape matters here: the hero is a wide banner and the card is 4:3, so
    // ask Flux for the right canvas rather than cropping a square later.
    const ratio = kind === "hero" ? ("16:9" as const) : ("4:3" as const);
    const prompt = `${scene}. ${STYLE}`;

    // Step 2 — draw it, then move it to storage we control.
    const temporaryUrl = await runFluxSchnell(prompt, ratio);
    const hosted = await rehostToBlob(temporaryUrl, {
      pathPrefix: "course-covers",
      filenameHint: `${courseId}-${kind}.webp`,
    });

    ok = true;
    // Deliberately NOT saved — it lands in the editor for approval first.
    return NextResponse.json({ url: hosted.url, prompt: scene });
  } catch (err) {
    console.error("[course-cover] failed", err);
    return NextResponse.json(
      { error: "Couldn't draw a picture just now. Try again in a moment." },
      { status: 502 },
    );
  } finally {
    void recordAiLatency("course.cover", Date.now() - t0, ok);
  }
}
