import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";

/** Where course enrolment + evaluation notices go. Grace (info@) asked to
 *  hear about every enrolment; kept as one constant so both notices agree. */
export const COURSE_NOTIFY_EMAIL = "info@thesensorysubmarine.com";
/** Public slug of the post-completion evaluation form (see scripts). */
export const COURSE_EVALUATION_SLUG = "course-evaluation";
const PORTAL_ORIGIN = "https://portal.thesensorysubmarine.com";

/** Tell Grace someone has enrolled (free or paid). Best-effort — never
 *  allowed to break the enrolment it reports on. */
async function notifyCourseEnrolment(userId: string, courseId: string) {
  try {
    const [user, course] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { title: true, price: true } }),
    ]);
    if (!course) return;
    const who = user?.name ? `${user.name} (${user.email})` : (user?.email ?? "A learner");
    const paidLine = course.price > 0 ? "This is a paid course, so a payment should follow if it hasn't already." : "This is a free course.";
    await sendTransactionalEmail({
      to: COURSE_NOTIFY_EMAIL,
      subject: `New course enrolment: ${course.title}`,
      html: `<p>Someone has just enrolled in one of your courses.</p>
<ul>
  <li><strong>Course:</strong> ${escapeCourseHtml(course.title)}</li>
  <li><strong>Learner:</strong> ${escapeCourseHtml(who)}</li>
</ul>
<p>${paidLine}</p>
<p style="font-size:12px;color:#777;">You can see all enrolments and payments in the portal.</p>`,
    });
  } catch (err) {
    console.error("[enrolment] Grace notification failed:", err);
  }
}

function escapeCourseHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Email the learner a short evaluation once they finish a course. Called
 * from the module-completion routes at the moment the enrolment flips to
 * COMPLETED (guarded there so it fires once). Links to the public
 * evaluation form with the course pre-filled. Best-effort.
 */
export async function sendCourseEvaluationEmail(enrollmentId: string): Promise<void> {
  try {
    const e = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { user: { select: { name: true, email: true } }, course: { select: { title: true } } },
    });
    if (!e?.user?.email) return;
    const first = e.user.name?.split(" ")[0] || "there";
    const url = `${PORTAL_ORIGIN}/f/${COURSE_EVALUATION_SLUG}?course=${encodeURIComponent(e.course.title)}`;
    await sendTransactionalEmail({
      to: e.user.email,
      subject: `How did you find ${e.course.title}?`,
      html: `<h2>Thanks for completing ${escapeCourseHtml(e.course.title)}!</h2>
<p>Hi ${escapeCourseHtml(first)}, we'd love a quick bit of feedback — it takes under a minute and genuinely shapes what we build next.</p>
<p style="margin:22px 0;">
  <a href="${url}" style="display:inline-block;background:#E71D57;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:800;font-size:15px;">Share your feedback</a>
</p>
<p style="font-size:13px;color:#777;">Just a couple of questions — how useful you found it, whether you'd recommend it, and what you'd like to see next.</p>
<p><strong>The Sensory Submarine</strong></p>`,
    });
  } catch (err) {
    console.error("[enrolment] evaluation email failed:", err);
  }
}

/**
 * Ensure the given user is enrolled in the course, seeding ModuleProgress
 * rows (first module IN_PROGRESS, the rest LOCKED). Idempotent — returns the
 * existing enrolment if one is already present.
 */
export async function ensureEnrollment(userId: string, courseId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  if (modules.length === 0) {
    throw new Error("Course has no modules");
  }

  const created = await prisma.enrollment.create({
    data: {
      userId,
      courseId,
      moduleProgress: {
        create: modules.map((mod, index) => ({
          moduleId: mod.id,
          status: index === 0 ? "IN_PROGRESS" : "LOCKED",
        })),
      },
    },
  });

  // Let Grace know about the new enrolment (free or paid). Non-blocking.
  void notifyCourseEnrolment(userId, courseId);

  return created;
}
