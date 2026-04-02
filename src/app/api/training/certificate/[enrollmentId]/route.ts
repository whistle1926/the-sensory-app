import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCertificateHTML } from "@/lib/generate-certificate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { enrollmentId } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true, duration: true } },
    },
  });

  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (enrollment.userId !== session.user.id && session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (enrollment.status !== "COMPLETED" || !enrollment.completedAt) {
    return NextResponse.json({ error: "Course not yet completed" }, { status: 400 });
  }

  const html = generateCertificateHTML({
    learnerName: enrollment.user.name,
    courseTitle: enrollment.course.title,
    courseDuration: enrollment.course.duration,
    completionDate: enrollment.completedAt,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
