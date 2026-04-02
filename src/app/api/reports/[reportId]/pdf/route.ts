import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const content = report.content as unknown as ReportContent;
  const html = generateReportHtml(content);

  // Return HTML that can be opened in browser and printed to PDF
  // For server-side PDF generation, Puppeteer/Chromium would be needed
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
