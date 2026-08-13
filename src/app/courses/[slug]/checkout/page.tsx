import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { courseAccessible } from "@/lib/storefront";
import { CheckoutView } from "@/components/courses/checkout-view";

export const dynamic = "force-dynamic";

/**
 * A real checkout page, replacing the buy pop-up.
 *
 * The dialog had nowhere to put anything: no order summary, and no room to
 * offer a second course alongside the first. A page has both — the buyer can
 * see what they're paying for before they commit, and the OT gets a place to
 * put add-ons that isn't a cramped modal.
 *
 * Add-ons are the ones chosen on the course itself (upsellCourseIds), not
 * whatever happens to be on sale, so the pairing is deliberate.
 */
export default async function CourseCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      shortDescription: true,
      duration: true,
      price: true,
      priceEur: true,
      status: true,
      thumbnailUrl: true,
      heroImageUrl: true,
      upsellCourseIds: true,
      modules: { select: { id: true } },
    },
  });
  if (!course || course.status !== "AVAILABLE") notFound();
  if (!(await courseAccessible({ id: course.id }))) notFound();

  // Only offer add-ons that are genuinely purchasable — an unfinished or
  // withdrawn course must never appear as a tick-box.
  const addonCourses = course.upsellCourseIds.length
    ? await prisma.course.findMany({
        where: {
          id: { in: course.upsellCourseIds.filter((id) => id !== course.id) },
          status: "AVAILABLE",
        },
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          shortDescription: true,
          price: true,
          priceEur: true,
          thumbnailUrl: true,
          modules: { select: { id: true } },
        },
      })
    : [];

  const addons = [];
  for (const a of addonCourses) {
    if (a.modules.length === 0) continue;
    if (!(await courseAccessible({ id: a.id }))) continue;
    addons.push({
      id: a.id,
      title: a.title,
      blurb: a.tagline || a.shortDescription || "",
      price: a.price,
      priceEur: a.priceEur,
      thumbnailUrl: a.thumbnailUrl,
    });
  }

  if (course.modules.length === 0) redirect(`/courses/${course.slug}`);

  return (
    <CheckoutView
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        blurb: course.tagline || course.shortDescription || "",
        duration: course.duration,
        price: course.price,
        priceEur: course.priceEur,
        thumbnailUrl: course.thumbnailUrl || course.heroImageUrl,
      }}
      addons={addons}
    />
  );
}
