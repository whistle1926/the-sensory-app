import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { courseAccessible, coursesEnabled } from "@/lib/storefront";
import { auth } from "@/lib/auth";
import { CourseDetailView } from "@/components/courses/course-detail-view";

export const dynamic = "force-dynamic";

interface Testimonial {
  quote?: string;
  author?: string;
  role?: string;
  avatarUrl?: string;
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Courses paused → no public course pages (content isn't ready). Staff are
  // the exception: they get a PREVIEW of the real page so they can see exactly
  // what a parent will see before putting it on sale. Previewing the genuine
  // page (rather than a mock-up) is the point — a separate preview screen
  // would drift from reality.
  const live = await courseAccessible({ slug });
  const session = await auth();
  const isStaff =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "TEAM_MANAGER";
  if (!live && !isStaff) notFound();
  const previewing = !live && isStaff;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        select: { id: true, title: true, order: true, videoUrl: true },
        orderBy: { order: "asc" },
      },
      resources: { select: { title: true }, orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) notFound();
  // Staff previewing an unpublished course get through here too — otherwise a
  // draft (Archived / Coming soon) would 404 before the preview banner ever
  // rendered, which is exactly the case the preview exists for.
  if (course.status !== "AVAILABLE" && !isStaff) notFound();

  const testimonials = Array.isArray(course.testimonials)
    ? (course.testimonials as Testimonial[])
    : [];
  const features = course.features ?? [];
  const heroImage = course.heroImageUrl ?? course.thumbnailUrl;
  return (
    <CourseDetailView
      previewing={previewing}
      showCoursesLink={await coursesEnabled()}
      course={{
        ...course,
        testimonials,
        features,
      }}
    />
  );
}
