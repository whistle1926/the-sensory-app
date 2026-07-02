import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { homeProgrammeHtml } from "@/lib/home-programme";

/**
 * Branded printable page for a home programme. Returns HTML the
 * browser opens in a new tab and prints / saves as PDF — the same
 * approach the report PDF uses (no headless-Chrome dependency).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const programme = await prisma.homeProgramme.findUnique({
    where: { id },
    include: {
      client: { select: { firstName: true, lastName: true } },
      author: { select: { name: true } },
    },
  });
  if (!programme)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientName = programme.client
    ? `${programme.client.firstName} ${programme.client.lastName}`
    : "—";
  const dateLabel = new Date(programme.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = homeProgrammeHtml({
    title: programme.title,
    body: programme.body,
    clientName,
    therapistName: programme.author?.name ?? "The Sensory Submarine",
    dateLabel,
  });

  // Auto-open the browser's print dialog so "Save as PDF" is one step from
  // the new tab — consistent with the report + form-submission exports.
  const printScript = `<script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>`;
  const withPrint = html.includes("</body>")
    ? html.replace("</body>", `${printScript}</body>`)
    : html + printScript;

  return new NextResponse(withPrint, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
