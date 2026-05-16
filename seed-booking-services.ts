/**
 * Seed the BookingService catalogue. Idempotent on slug — re-running
 * after Patrick / Grace edit one in the admin won't undo their changes
 * (we only insert when slug doesn't yet exist).
 *
 * Original 4 (initial-ot / follow-up / school / sensory-eaters)
 * preserved so historical bookings still resolve their service. Six
 * new services added per Grace's May 2026 pricing sheet.
 *
 * Usage:
 *   node _run-with-env.js npx tsx ./seed-booking-services.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ServiceSeed {
  slug: string;
  title: string;
  description: string;
  tagline?: string;
  category: string;
  pricePence: number;
  durationLabel: string;
  durationMinutes: number;
  depositPence?: number;
}

const SERVICES: ServiceSeed[] = [
  // ── Existing legacy services (kept for backwards-compat) ───────────
  {
    slug: "initial-ot",
    title: "Initial OT Consultation (online)",
    tagline: "Online video consultation",
    category: "Parents & individuals",
    pricePence: 8500,
    durationLabel: "60 minutes",
    durationMinutes: 60,
    depositPence: 0,
    description:
      "Comprehensive initial assessment via video call. Includes discussion of presenting concerns, observation of your child during play, and immediate practical recommendations.",
  },
  {
    slug: "follow-up",
    title: "Follow-Up Session",
    tagline: "Online video session",
    category: "Parents & individuals",
    pricePence: 6500,
    durationLabel: "45 minutes",
    durationMinutes: 45,
    description:
      "Review progress, adjust strategies, and address new concerns. Includes updated home programme recommendations.",
  },
  {
    slug: "school-online",
    title: "School Consultation (online)",
    tagline: "Online video consultation",
    category: "Schools & community",
    pricePence: 4500,
    durationLabel: "30 minutes",
    durationMinutes: 30,
    description:
      "Video call with your child's teacher or SENCO to discuss sensory strategies for the classroom.",
  },
  {
    slug: "sensory-eaters",
    title: "Sensory Eaters Programme",
    tagline: "Online group programme",
    category: "Parents & individuals",
    pricePence: 25000,
    durationLabel: "6 × 45 minutes",
    durationMinutes: 270,
    description:
      "Structured online programme for parents of children with selective eating. Small group format (max 6 families).",
  },

  // ── New services from Grace's May 2026 pricing sheet ───────────────
  {
    slug: "face-to-face-ot-assessment",
    title: "Face to Face Occupational Therapy Assessment",
    tagline: "Comprehensive bespoke assessment",
    category: "Parents & individuals",
    pricePence: 34700,
    durationLabel: "1 hour clinic appointment",
    durationMinutes: 60,
    depositPence: 10000,
    description:
      "A comprehensive assessment bespoke to your child's needs. Typically includes:\n• Pre-assessment parent questionnaire\n• 1-hour in-person clinic appointment (play-based observation, developmental checklist, and functional assessment)\n• Parent discussion to explore priorities and goals\n• Sensory profile if indicated\n• Comprehensive recommendations for home and daily life\n\nClinics in Coalisland or Armagh. Home visit appointments can be arranged if preferred (travel surcharge may apply).",
  },
  {
    slug: "block-of-ot",
    title: "Block of Occupational Therapy",
    tagline: "5-session targeted therapy block",
    category: "Parents & individuals",
    pricePence: 44700,
    durationLabel: "5 × 45–60 minutes",
    durationMinutes: 60,
    description:
      "A structured 5-session block (45–60 minutes each) to work towards agreed goals. Sessions may include:\n• Targeted therapy to develop functional skills\n• Sensory regulation support\n• Parent coaching and practical home strategies\n\nCan be completed in clinic (Coalisland or Armagh) or at home (travel surcharge may apply).",
  },
  {
    slug: "school-observation",
    title: "School Observation",
    tagline: "Focused in-person school visit",
    category: "Parents & individuals",
    pricePence: 19700,
    durationLabel: "1 hour visit",
    durationMinutes: 60,
    description:
      "A focused 1-hour visit to your child's pre-school or school environment. Includes:\n• Observation of your child in class and playground\n• Consultation with teachers and classroom assistants\n• Comprehensive feedback and practical strategies to support participation and regulation in school\n\nA written summary of key recommendations is provided following the visit. Travel surcharge may apply.",
  },
  {
    slug: "bespoke-training-package",
    title: "Bespoke Training Package",
    tagline: "Face-to-face training for your setting",
    category: "Schools & community",
    pricePence: 29700,
    durationLabel: "2 hours",
    durationMinutes: 120,
    description:
      "We provide face-to-face bespoke training sessions tailored to the specific needs of your organisation. Training can be delivered on a wide range of topics, including:\n• Supporting sensory regulation in the classroom\n• Developing pre-writing skills through play\n• Supporting fine and gross motor skills in the early years\n• Making tummy time fun and understanding its benefits for babies' development\n\nSessions typically last 2 hours and are perfect for CPD and professional development, helping staff better support the children in their care. Travel surcharge may apply.",
  },
  {
    slug: "sensory-play-session",
    title: "Sensory Play Session",
    tagline: "Themed sensory play experience for your setting",
    category: "Schools & community",
    pricePence: 19700,
    durationLabel: "1 hour (max 25 children)",
    durationMinutes: 60,
    description:
      "We can bring our unique sensory play experience directly to your school, pre-school, or organisation. Each 1-hour session (maximum 25 children) includes:\n• Themed sensory and messy play stations\n• Movement and gross motor areas\n• Calm corner\n• Stories, songs, games, dancing, and arts & crafts\n\nAll sessions are inclusive, engaging, and tailored to your chosen theme.",
  },
  {
    slug: "small-group-ot",
    title: "Small Group Occupational Therapy Sessions",
    tagline: "Block of 4 small-group sessions",
    category: "Schools & community",
    pricePence: 49700,
    durationLabel: "4 sessions",
    durationMinutes: 60,
    description:
      "We offer focused, small group Occupational Therapy sessions in schools and early years settings (maximum 4 children per group). Groups are tailored to the specific needs of the children attending and can focus on areas such as:\n• Handwriting\n• Fine and gross motor skills\n• Sensory regulation\n• Attention and listening\n• Emotional wellbeing\n\nEach block includes 4 sessions designed to support children's functional and developmental goals.",
  },
];

async function main() {
  // Establish baseline order — append after whatever's already there.
  const last = await prisma.bookingService.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (last?.order ?? -1) + 1;

  let created = 0;
  let skipped = 0;

  for (const svc of SERVICES) {
    const existing = await prisma.bookingService.findUnique({
      where: { slug: svc.slug },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.bookingService.create({
      data: {
        slug: svc.slug,
        title: svc.title,
        description: svc.description,
        tagline: svc.tagline ?? null,
        category: svc.category,
        pricePence: svc.pricePence,
        durationLabel: svc.durationLabel,
        durationMinutes: svc.durationMinutes,
        depositPence: svc.depositPence ?? 0,
        isActive: true,
        order: nextOrder++,
      },
    });
    created++;
    console.log(`  + ${svc.slug} (£${(svc.pricePence / 100).toFixed(2)})`);
  }

  console.log(`\nDone. ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
