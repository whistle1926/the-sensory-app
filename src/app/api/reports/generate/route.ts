import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReportSchema } from "@/lib/validators";
import { generateReport } from "@/lib/claude";
import { format } from "date-fns";

// The Anthropic call now reliably takes 25-35s after the prompt
// was expanded to auto-fill the Functional Review fields. Vercel's
// default function timeout (10s on Hobby, 15s on Pro) was killing
// the request and leaving the browser stuck on a spinner. 60s is
// the maximum allowed on Hobby/Pro plans and gives comfortable
// headroom over typical generation latency.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = generateReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
  });

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const therapist = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  // Each stage is wrapped so we can return a clear error to the UI
  // instead of a generic 500. Generation failures (Claude API, JSON
  // parse) usually beat DB failures, so we split them out.
  let reportContent;
  try {
    reportContent = await generateReport(
      {
        firstName: client.firstName,
        lastName: client.lastName,
        dateOfBirth: format(client.dateOfBirth, "dd/MM/yyyy"),
        diagnosis: client.diagnosis,
        presentingConcerns: client.presentingConcerns,
        referrer: client.referrer,
        parentCarerName: client.parentCarerName,
      },
      parsed.data.sessionDate,
      parsed.data.sessionNumber,
      parsed.data.rawNotes,
      therapist?.name || session.user.name,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reports/generate] Claude failure:", err);
    // Make common failure modes recognisable on the UI banner.
    const hint = /api[_ ]?key/i.test(msg)
      ? "Claude API key is missing or invalid (check ANTHROPIC_API_KEY in Vercel env)."
      : /json|parse/i.test(msg)
        ? "Claude returned a response we couldn't parse — try again, or shorten the session notes."
        : /timeout|aborted/i.test(msg)
          ? "Claude took too long to respond. Try again, or shorten the session notes."
          : msg.slice(0, 240);
    return NextResponse.json(
      { error: `AI generation failed: ${hint}` },
      { status: 502 },
    );
  }

  try {
    const therapySession = await prisma.therapySession.create({
      data: {
        clientId: client.id,
        therapistId: session.user.id,
        sessionDate: new Date(parsed.data.sessionDate),
        sessionNumber: parsed.data.sessionNumber,
        rawNotes: parsed.data.rawNotes,
      },
    });

    const report = await prisma.report.create({
      data: {
        clientId: client.id,
        sessionId: therapySession.id,
        authorId: session.user.id,
        content: JSON.parse(JSON.stringify(reportContent)),
      },
    });

    return NextResponse.json({ reportId: report.id }, { status: 201 });
  } catch (err) {
    console.error("[reports/generate] DB failure:", err);
    return NextResponse.json(
      {
        error: `Saving the report failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}
