import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { letterHtml } from "@/lib/letter";

/**
 * Branded printable letter — HTML opened in a new tab and printed / saved
 * as PDF (same print-to-PDF approach as reports + home programmes).
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
  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      client: { select: { firstName: true, lastName: true } },
      author: { select: { name: true } },
    },
  });
  if (!letter)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientName = letter.client
    ? `${letter.client.firstName} ${letter.client.lastName}`
    : "—";
  const dateLabel = new Date(letter.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = letterHtml({
    title: letter.title,
    body: letter.body,
    recipient: letter.recipient,
    clientName,
    therapistName: letter.author?.name ?? "The Sensory Submarine",
    dateLabel,
  });

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
