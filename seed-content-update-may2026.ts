/**
 * One-off content sweep for the May 2026 client feedback batch:
 *
 *  1. Strip "CPD accredited" / "CPD-accredited" from every course
 *     description, shortDescription, tagline — replace with "CPD course".
 *  2. Apply Grace's standard instructor bio + role to every existing
 *     course (Patrick can override per-course later via the admin
 *     editor when other instructors come online).
 *  3. Seed `audienceFor` for the Fine Motor course with the wording
 *     the client provided as an example. Other courses left null —
 *     Grace to supply per-course wording.
 *
 * Idempotent — re-running is safe. Reads existing values, applies the
 * string replacement only when a change is needed.
 *
 * Usage: node _run-with-env.js npx tsx ./seed-content-update-may2026.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GRACE_BIO =
  "Grace is a highly experienced occupational therapist with extensive postgraduate training. She works clinically with children of all ages and supports parents, professionals, and educators in understanding sensory processing, child development, sensory eating, and sensory play. Grace is passionate about sharing her knowledge in a practical, accessible way and providing child-centred, playful occupational therapy that helps children thrive.";

const FINE_MOTOR_AUDIENCE =
  "This course is beneficial for parents of pre-school and primary school-aged children who need extra support with fine motor skills. It is ideal for children who struggle with handwriting, using scissors, or everyday tasks such as buttons and zips.";

/** "CPD accredited" / "CPD-accredited" / case variants → "CPD course". */
function rewriteCpd(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  return s.replace(/\bCPD[- ]accredited\b/gi, "CPD course");
}

async function main() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      shortDescription: true,
      description: true,
      instructorName: true,
      instructorRole: true,
      instructorBio: true,
      audienceFor: true,
    },
  });

  console.log(`Sweeping ${courses.length} courses…`);
  let cpdHits = 0;
  let bioApplied = 0;
  let audienceApplied = 0;

  for (const c of courses) {
    const updated: Record<string, string | null> = {};

    // 1. CPD wording sweep — only update if the field actually changed.
    const newTagline = rewriteCpd(c.tagline);
    if (newTagline !== c.tagline) updated.tagline = newTagline;
    const newShort = rewriteCpd(c.shortDescription);
    if (newShort !== c.shortDescription) updated.shortDescription = newShort;
    const newDesc = rewriteCpd(c.description);
    if (newDesc !== c.description) updated.description = newDesc;

    if (
      updated.tagline !== undefined ||
      updated.shortDescription !== undefined ||
      updated.description !== undefined
    ) {
      cpdHits++;
    }

    // 2. Grace's bio — apply only where the bio is missing or matches a
    //    known placeholder (avoid stomping per-course customisation).
    if (!c.instructorBio || c.instructorBio.length < 80) {
      updated.instructorName = c.instructorName ?? "Grace Magennis";
      updated.instructorRole = c.instructorRole ?? "Founder & Course Director";
      updated.instructorBio = GRACE_BIO;
      bioApplied++;
    }

    // 3. audienceFor — set the Fine Motor course as a concrete example.
    if (c.slug === "fine-motor-at-home" && !c.audienceFor) {
      updated.audienceFor = FINE_MOTOR_AUDIENCE;
      audienceApplied++;
    }

    if (Object.keys(updated).length > 0) {
      await prisma.course.update({ where: { id: c.id }, data: updated });
      console.log(`  ↻ ${c.slug}: ${Object.keys(updated).join(", ")}`);
    }
  }

  console.log(
    `\nDone. CPD-rewrite touched ${cpdHits} course(s); ` +
      `bio applied to ${bioApplied}; audienceFor seeded on ${audienceApplied}.`,
  );

  // Storefront config — seed defaults if the row doesn't exist yet.
  // Patrick can edit these via Settings → Storefront once that ships.
  await prisma.storefrontConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      tagline: "Where expert knowledge meets playful, child-centred practice",
      heroTitle:
        "Evidence-based courses, specialist occupational therapy services, and support for parents and professionals",
      heroBlurb:
        "Supporting children to thrive through expert-led courses, specialist assessments, and personalised occupational therapy. Designed for parents, educators, and professionals seeking practical, child-centred strategies that make a real difference.",
    },
  });
  console.log("✓ StorefrontConfig default row ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
