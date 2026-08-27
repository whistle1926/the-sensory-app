import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/rich-text";

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
      resources: { select: { title: true }, orderBy: { order: "asc" } },
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
    level: course.level,
    price: course.price,
    priceEur: course.priceEur,
    upsellCourseIds: course.upsellCourseIds,
    upsellHeadline: course.upsellHeadline,
    isFeatured: course.isFeatured,
    isBestseller: course.isBestseller,
    // These were missing from the whitelist, so the editor loaded them as
    // undefined: "Sell this one now" and the certificate switch always drew
    // themselves OFF however the course was actually set, and the preview
    // insisted a live course was "not on sale yet".
    isLive: course.isLive,
    hasCertificate: course.hasCertificate,
    copyNotes: course.copyNotes,
    resources: course.resources,
    tagline: course.tagline,
    shortDescription: course.shortDescription,
    heroImageUrl: course.heroImageUrl,
    thumbnailUrl: course.thumbnailUrl,
    features: course.features,
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

  // ── Basic course meta ────────────────────────────────────────────────
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    data.title = t.slice(0, 200);
  }
  if (typeof body.audience === "string")
    data.audience = body.audience.trim().slice(0, 120);
  if (typeof body.duration === "string")
    data.duration = body.duration.trim().slice(0, 120);
  // Now rich text from the editor. Sanitised on the way in, and the cap is
  // generous because markup inflates the length well past the visible words.
  if (typeof body.description === "string")
    data.description = sanitizeRichText(body.description).slice(0, 20_000);
  if (typeof body.level === "string")
    data.level = body.level.trim().slice(0, 60) || null;

  // ── Pricing & visibility ─────────────────────────────────────────────
  if (typeof body.upsellHeadline === "string") {
    data.upsellHeadline = body.upsellHeadline.trim().slice(0, 160) || null;
  }
  if (Array.isArray(body.upsellCourseIds)) {
    data.upsellCourseIds = body.upsellCourseIds
      .filter((x: unknown): x is string => typeof x === "string")
      .slice(0, 6);
  }
  // Euro price: a number sets it, null clears it back to sterling-only.
  if (body.priceEur === null) {
    data.priceEur = null;
  } else if (typeof body.priceEur === "number" && Number.isFinite(body.priceEur)) {
    data.priceEur = Math.max(0, Math.floor(body.priceEur));
  }
  if (typeof body.price === "number" && Number.isFinite(body.price)) {
    const p = Math.max(0, Math.floor(body.price));
    data.price = p;
  }
  if (typeof body.status === "string") {
    const allowed = new Set(["AVAILABLE", "COMING_SOON", "ARCHIVED"]);
    if (!allowed.has(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured;
  // Publish this one course even while the whole Courses section is paused.
  if (typeof body.isLive === "boolean") data.isLive = body.isLive;
  if (typeof body.hasCertificate === "boolean")
    data.hasCertificate = body.hasCertificate;
  if (typeof body.copyNotes === "string")
    data.copyNotes = body.copyNotes.trim().slice(0, 5_000) || null;
  if (typeof body.isBestseller === "boolean") data.isBestseller = body.isBestseller;

  // ── Storefront copy ─────────────────────────────────────────────────
  if (typeof body.tagline === "string")
    data.tagline = body.tagline.trim().slice(0, 240) || null;
  if (typeof body.shortDescription === "string")
    data.shortDescription =
      body.shortDescription.trim().slice(0, 500) || null;
  if (typeof body.heroImageUrl === "string")
    data.heroImageUrl = body.heroImageUrl.trim().slice(0, 1_000) || null;
  if (typeof body.thumbnailUrl === "string")
    data.thumbnailUrl = body.thumbnailUrl.trim().slice(0, 1_000) || null;
  if (Array.isArray(body.features)) {
    data.features = (body.features as unknown[])
      .filter((f): f is string => typeof f === "string")
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
      .map((f) => f.slice(0, 300))
      .slice(0, 20);
  }

  // ── Instructor + audienceFor + progression (existing) ──────────────
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

/**
 * Delete a course. Staff only. Refuses if anyone has paid for the
 * course (we keep historical purchase records intact); in that case
 * the recommended fallback is to set status=ARCHIVED via PATCH.
 */
export async function DELETE(
  _req: NextRequest,
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

  const paidPurchases = await prisma.coursePurchase.count({
    where: { courseId, paymentStatus: "paid" },
  });
  if (paidPurchases > 0) {
    return NextResponse.json(
      {
        error:
          "This course has paid purchases — archive it instead (Status → Archived) to preserve order history.",
      },
      { status: 409 },
    );
  }

  // Prisma's onDelete: Cascade rules already wipe modules + enrollments
  // + module progress when the course goes. Notes + testimonials live
  // on the row itself.
  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}
