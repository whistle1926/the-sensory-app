import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public list of AVAILABLE courses for the storefront. Ordered so featured
// courses surface first; inside each bucket we fall back to `order` then
// created-at for determinism.
export async function GET() {
  const courses = await prisma.course.findMany({
    where: { status: "AVAILABLE" },
    orderBy: [
      { isFeatured: "desc" },
      { order: "asc" },
      { createdAt: "asc" },
    ],
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
      price: true,
      thumbnailUrl: true,
      heroImageUrl: true,
      isFeatured: true,
      isBestseller: true,
      accreditationBadges: true,
      _count: { select: { modules: true, enrollments: true } },
    },
  });
  return NextResponse.json(courses);
}
