/**
 * Seed two test CLIENT users so Patrick can log in as a learner and see what
 * the parent / course-buyer experience looks like. Idempotent — re-running
 * just resets the password and ensures the right enrollments/purchases exist.
 *
 *   freeuser@test.thesensorysubmarine.com  / sensory123  → enrolled in a free course only
 *   paiduser@test.thesensorysubmarine.com  / sensory123  → enrolled in a free + paid course, paid purchase recorded
 *
 * Usage:
 *   node _run-with-env.js npx tsx ./seed-test-users.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "sensory123";
const FREE_EMAIL = "freeuser@test.thesensorysubmarine.com";
const PAID_EMAIL = "paiduser@test.thesensorysubmarine.com";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Pick a free + a paid course that already exist in the DB.
  const freeCourse = await prisma.course.findFirst({
    where: { status: "AVAILABLE", price: 0 },
    orderBy: { createdAt: "asc" },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  const paidCourse = await prisma.course.findFirst({
    where: { status: "AVAILABLE", price: { gt: 0 } },
    orderBy: { price: "asc" },
    include: { modules: { orderBy: { order: "asc" } } },
  });

  if (!freeCourse) throw new Error("No free AVAILABLE course found to enrol the free user into.");
  if (!paidCourse) throw new Error("No paid AVAILABLE course found to enrol the paid user into.");

  console.log(`Free course:  ${freeCourse.title} (${freeCourse.slug}) — £${freeCourse.price}`);
  console.log(`Paid course:  ${paidCourse.title} (${paidCourse.slug}) — £${paidCourse.price}`);

  // ── Free user ────────────────────────────────────────────────────────
  const freeUser = await prisma.user.upsert({
    where: { email: FREE_EMAIL },
    update: { passwordHash, name: "Test Free User", role: "CLIENT" },
    create: {
      email: FREE_EMAIL,
      passwordHash,
      name: "Test Free User",
      role: "CLIENT",
    },
  });
  await ensureEnrollment(freeUser.id, freeCourse.id, freeCourse.modules.map((m) => m.id));
  console.log(`✓ Free user ready:  ${FREE_EMAIL}  (enrolled in 1 free course, no purchases)`);

  // ── Paid user ────────────────────────────────────────────────────────
  const paidUser = await prisma.user.upsert({
    where: { email: PAID_EMAIL },
    update: { passwordHash, name: "Test Paid User", role: "CLIENT" },
    create: {
      email: PAID_EMAIL,
      passwordHash,
      name: "Test Paid User",
      role: "CLIENT",
    },
  });
  await ensureEnrollment(paidUser.id, freeCourse.id, freeCourse.modules.map((m) => m.id));
  await ensureEnrollment(paidUser.id, paidCourse.id, paidCourse.modules.map((m) => m.id));
  await ensurePurchase(paidUser.id, paidCourse.id, paidCourse.price);
  console.log(`✓ Paid user ready:  ${PAID_EMAIL}  (enrolled in 1 free + 1 paid course, £${paidCourse.price} paid)`);

  console.log("\nLogin URL: https://sensory.aiworldexperts.com/login");
  console.log(`Password (both): ${PASSWORD}`);
}

async function ensureEnrollment(userId: string, courseId: string, moduleIds: string[]) {
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId, status: "IN_PROGRESS" },
  });
  // Seed module progress rows so the lesson player has something to read.
  for (let i = 0; i < moduleIds.length; i++) {
    await prisma.moduleProgress.upsert({
      where: { enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId: moduleIds[i] } },
      update: {},
      create: {
        enrollmentId: enrollment.id,
        moduleId: moduleIds[i],
        status: i === 0 ? "IN_PROGRESS" : "LOCKED",
      },
    });
  }
}

async function ensurePurchase(userId: string, courseId: string, amount: number) {
  // Use a deterministic payment ref so re-running doesn't create dupes.
  const paymentRef = `test-seed-${userId}-${courseId}`;
  await prisma.coursePurchase.upsert({
    where: { paymentRef },
    update: { paymentStatus: "paid", amount, completedAt: new Date() },
    create: {
      userId,
      courseId,
      amount,
      paymentStatus: "paid",
      paymentRef,
      completedAt: new Date(),
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
