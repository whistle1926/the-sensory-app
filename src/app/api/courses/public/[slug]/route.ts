import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public detail endpoint. Returns the course + a trimmed module list for the
// curriculum preview — we deliberately DO NOT return module content / quiz
// questions / answers because the course is behind a paywall.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      shortDescription: true,
      description: true,
      audience: true,
      duration: true,
      level: true,
      status: true,
      price: true,
      thumbnailUrl: true,
      heroImageUrl: true,
      features: true,
      accreditationBadges: true,
      instructorName: true,
      instructorRole: true,
      instructorBio: true,
      instructorImageUrl: true,
      testimonials: true,
      isFeatured: true,
      isBestseller: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { enrollments: true } },
      modules: {
        select: {
          id: true,
          title: true,
          order: true,
          videoUrl: true, // only to render a "video" icon — not the URL itself
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course || course.status !== "AVAILABLE") {
    return NextResponse.json(
      { error: "This course isn't available." },
      { status: 404 },
    );
  }

  // Scrub videoUrl to a boolean so we don't leak the CDN link before purchase.
  const sanitisedModules = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    order: m.order,
    hasVideo: !!m.videoUrl,
  }));

  return NextResponse.json({ ...course, modules: sanitisedModules });
}
