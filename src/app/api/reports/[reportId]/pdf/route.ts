import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { generateReportHtml } from "@/lib/generate-pdf";
import { ReportContent } from "@/types/report";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { reportId } = await params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cross-tenant guard — without this, any logged-in user could
  // download any other client's report PDF by changing the id.
  if (!canAccessClient(session.user.role, session.user.id, report.client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = report.content as unknown as ReportContent;
  const html = generateReportHtml(content);

  // We render a branded HTML page and let the browser "Save as PDF" via
  // its print dialog (no headless-Chrome dependency — same approach as
  // home programmes and form submissions). Auto-opening the print dialog
  // makes it one step from the new tab. The previous flow fetched this
  // HTML and saved it as a ".pdf" file, which produced a broken document.
  const printScript = `<script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>`;
  const withPrint = html.includes("</body>")
    ? html.replace("</body>", `${printScript}</body>`)
    : html + printScript;

  return new NextResponse(withPrint, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
