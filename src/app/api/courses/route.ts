import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Slugify a title for `Course.slug`. Falls back to a timestamp if the
 * title produces an empty slug (e.g. emoji-only). Collisions are
 * resolved by appending a 4-char random suffix in the POST handler. */
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `course-${Date.now().toString(36)}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    include: {
      modules: { select: { id: true }, orderBy: { order: "asc" } },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: { select: { status: true } },
        },
      },
    },
  });

  const result = courses.map((course) => {
    const enrollment = course.enrollments[0] ?? null;
    const totalModules = course.modules.length;
    const completedModules = enrollment
      ? enrollment.moduleProgress.filter((mp) => mp.status === "COMPLETED").length
      : 0;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      audience: course.audience,
      duration: course.duration,
      description: course.description,
      status: course.status,
      order: course.order,
      price: course.price,
      isFeatured: course.isFeatured,
      isBestseller: course.isBestseller,
      totalModules,
      enrollmentStatus: enrollment?.status ?? null,
      enrollmentId: enrollment?.id ?? null,
      completedModules,
      progressPercent: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}

/**
 * Create a new course — staff only. Defaults to ARCHIVED + free so a
 * half-finished course can't accidentally appear on the storefront
 * before the author has filled in title/description/modules/price etc.
 *
 * Body (all optional): { title }. Everything else takes sensible
 * defaults that the editor will then let the user fill in.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Untitled course";

  // Resolve a unique slug. Try the bare slug first; on collision suffix
  // with random chars and retry. Caps at 5 attempts so a pathological
  // case still produces a response.
  let slug = slugify(title);
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.course.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Append to the bottom of the list by default.
  const last = await prisma.course.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.course.create({
    data: {
      title,
      slug,
      audience: "",
      duration: "",
      description: "",
      status: "ARCHIVED", // hidden until the author flips to AVAILABLE
      price: 0,
      order: (last?.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
}
