import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, order: true },
      },
      enrollments: {
        where: { userId: session.user.id },
        include: {
          moduleProgress: {
            select: { moduleId: true, status: true, score: true, attempts: true, completedAt: true },
          },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = course.enrollments[0] ?? null;
  const progressMap = new Map(
    enrollment?.moduleProgress.map((mp) => [mp.moduleId, mp]) ?? []
  );

  const modules = course.modules.map((mod) => {
    const progress = progressMap.get(mod.id);
    return {
      ...mod,
      status: progress?.status ?? "LOCKED",
      score: progress?.score ?? null,
      attempts: progress?.attempts ?? 0,
      completedAt: progress?.completedAt ?? null,
    };
  });

  return NextResponse.json({
    id: course.id,
    title: course.title,
    slug: course.slug,
    audience: course.audience,
    duration: course.duration,
    description: course.description,
    status: course.status,
    instructorName: course.instructorName,
    instructorRole: course.instructorRole,
    instructorBio: course.instructorBio,
    instructorImageUrl: course.instructorImageUrl,
    audienceFor: course.audienceFor,
    nextCourseId: course.nextCourseId,
    testimonials: course.testimonials,
    modules,
    enrollmentId: enrollment?.id ?? null,
    enrollmentStatus: enrollment?.status ?? null,
    completedAt: enrollment?.completedAt ?? null,
  });
}

/** Staff-only — update editable course content fields. We're conservative
 * about which fields are exposed; price/status/slug stay seed-script-
 * managed for now to avoid accidental "free your paid course" mistakes. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TEAM_MANAGER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (typeof body.instructorName === "string")
    data.instructorName = body.instructorName.trim().slice(0, 120) || null;
  if (typeof body.instructorRole === "string")
    data.instructorRole = body.instructorRole.trim().slice(0, 120) || null;
  if (typeof body.instructorBio === "string")
    data.instructorBio = body.instructorBio.trim().slice(0, 5_000) || null;
  if (typeof body.instructorImageUrl === "string")
    data.instructorImageUrl = body.instructorImageUrl.trim().slice(0, 500) || null;
  if (typeof body.audienceFor === "string")
    data.audienceFor = body.audienceFor.trim().slice(0, 2_000) || null;
  if (body.nextCourseId === null) data.nextCourseId = null;
  else if (typeof body.nextCourseId === "string")
    data.nextCourseId = body.nextCourseId.trim() || null;

  // Testimonials — accept an array of { quote, author, role?, avatarUrl? }.
  // Anything malformed is silently dropped rather than 400ing the save.
  if (Array.isArray(body.testimonials)) {
    const sanitised = body.testimonials
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const obj = t as Record<string, unknown>;
        const quote = typeof obj.quote === "string" ? obj.quote.trim() : "";
        const author =
          typeof obj.author === "string" ? obj.author.trim() : "";
        if (!quote || !author) return null;
        const result: Record<string, string> = {
          quote: quote.slice(0, 1_000),
          author: author.slice(0, 120),
        };
        if (typeof obj.role === "string" && obj.role.trim())
          result.role = obj.role.trim().slice(0, 120);
        if (typeof obj.avatarUrl === "string" && obj.avatarUrl.trim())
          result.avatarUrl = obj.avatarUrl.trim().slice(0, 500);
        return result;
      })
      .filter((t): t is Record<string, string> => t !== null);
    data.testimonials = sanitised;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data,
  });
  return NextResponse.json({ ok: true, id: updated.id });
}
