/**
 * One-off seed for the public course storefront. Creates 4 realistic-sounding
 * courses (mix of free + paid, one featured + one bestseller) with AI-
 * generated cover images. Skips cleanly if the courses already exist.
 *
 * Usage:
 *   npx tsx ./seed-courses.ts
 *
 * Requires ANTHROPIC_API_KEY + REPLICATE_API_TOKEN + BLOB_READ_WRITE_TOKEN in
 * .env.local (same vars the leaflet generator uses). Cover images are
 * generated with Flux Schnell and re-hosted to Vercel Blob.
 */
import { PrismaClient } from "@prisma/client";
import Replicate from "replicate";
import { put } from "@vercel/blob";

const prisma = new PrismaClient();

interface SeedCourse {
  slug: string;
  title: string;
  audience: string;
  duration: string;
  level: string;
  price: number;
  tagline: string;
  shortDescription: string;
  description: string;
  features: string[];
  imagePrompt: string; // Flux prompt for the hero image
  isFeatured?: boolean;
  isBestseller?: boolean;
  instructorName: string;
  instructorRole: string;
  instructorBio: string;
  testimonials: Array<{ quote: string; author: string; role?: string }>;
  modules: string[]; // titles; modules seeded with empty content for now
}

const COURSES: SeedCourse[] = [
  {
    slug: "sensory-regulation-foundations",
    title: "Sensory Regulation Foundations",
    audience: "Parents and carers",
    duration: "2 hours",
    level: "Beginner",
    price: 49,
    tagline: "Understand your child's sensory world — and what to do next.",
    shortDescription:
      "A parent-friendly introduction to the eight senses, regulation, and practical day-to-day strategies.",
    description:
      "This course is a warm, evidence-based introduction to sensory regulation for parents and carers. Over five short modules you'll learn how the sensory systems work, why regulation is the foundation of learning and behaviour, and how to use simple activities to support your child at home. You'll finish with a clear plan and a toolkit of strategies to try today.",
    features: [
      "Understand the eight sensory systems — not just the five",
      "Spot signs of over- and under-responsivity in real situations",
      "Build a daily 'sensory diet' that fits your family",
      "Use calming, alerting and organising activities with confidence",
      "Know when to seek more support",
    ],
    imagePrompt:
      "Warm, friendly children's book illustration, flat cartoon style, soft pastel colours, a parent and a happy child doing a balance activity on a rug in a sunny sitting room, plush toys nearby, no text, no logos, clean simple background",
    isFeatured: true,
    isBestseller: true,
    instructorName: "Grace Magennis",
    instructorRole: "Paediatric Occupational Therapist",
    instructorBio:
      "Grace is a paediatric OT with over a decade of experience supporting children with sensory, motor and regulation needs. She founded The Sensory Submarine to make evidence-based strategies accessible to every family.",
    testimonials: [
      {
        quote:
          "Honestly life-changing. I finally understand why my son melts down at the supermarket — and what to do before we get there.",
        author: "Laura, mum of two",
      },
      {
        quote:
          "Practical, warm and never preachy. I recommend it to every new client.",
        author: "Ciara O'Sullivan",
        role: "Speech & Language Therapist",
      },
    ],
    modules: [
      "Welcome — what this course covers",
      "The eight senses, explained simply",
      "Regulation: the engine behind everything",
      "Spotting over- and under-responsivity",
      "Building your family's sensory diet",
    ],
  },
  {
    slug: "fine-motor-at-home",
    title: "Fine Motor at Home",
    audience: "Parents and carers",
    duration: "90 minutes",
    level: "Beginner",
    price: 0,
    tagline: "Little hands, big skills — playful activities you can start today.",
    shortDescription:
      "Free mini-course with simple, fun fine motor activities using things you already have at home.",
    description:
      "A free taster course giving you ten beautiful fine motor activities to try at home — using nothing fancier than playdough, pegs, paper and masking tape. Perfect for preschoolers and early school-age children who'd benefit from more hand strength, pincer grip and bilateral coordination.",
    features: [
      "Ten ready-to-go fine motor activities",
      "Clear video walkthroughs for each",
      "A printable 'try this week' checklist",
      "Tips for making each activity harder or easier",
    ],
    imagePrompt:
      "Cheerful children's book illustration, flat cartoon style, a child's hands playing with colourful playdough and threading beads at a kitchen table, soft morning light, pastel pink and teal palette, no text, clean neutral background",
    isFeatured: true,
    instructorName: "Grace Magennis",
    instructorRole: "Paediatric Occupational Therapist",
    instructorBio:
      "Grace is a paediatric OT focused on practical, playful ways to build fine motor skills without pulling children away from what they love.",
    testimonials: [
      {
        quote: "Brilliant for a rainy afternoon. My 4-year-old hasn't stopped.",
        author: "Aoife, parent",
      },
    ],
    modules: [
      "Why fine motor matters",
      "Hand strength — 3 activities",
      "Pincer grip — 3 activities",
      "Bilateral coordination — 4 activities",
    ],
  },
  {
    slug: "understanding-the-eight-senses",
    title: "Understanding the Eight Senses",
    audience: "Practitioners and students",
    duration: "3 hours",
    level: "Intermediate",
    price: 89,
    tagline: "CPD-accredited deep-dive for OTs, teachers and allied professionals.",
    shortDescription:
      "A practitioner-focused course exploring each sensory system in depth, with clinical examples and screening tools.",
    description:
      "Built for OTs, teachers and allied professionals, this three-hour course takes you through each of the eight sensory systems with clinical depth. You'll get screening checklists, observation frameworks, and practical intervention ideas you can use on Monday morning.",
    features: [
      "Detailed neurobiology of each sensory system",
      "Screening and observation checklists",
      "Case studies with typical vs atypical presentations",
      "Intervention planning frameworks",
      "3 CPD hours certified on completion",
    ],
    imagePrompt:
      "Friendly children's book style illustration, flat cartoon, a therapist observing a child on a therapy ball in a bright sensory gym, colourful mats, rope swing visible, pastel palette, no text, no logos, neutral background",
    instructorName: "Grace Magennis",
    instructorRole: "Paediatric Occupational Therapist",
    instructorBio:
      "Grace lectures at postgraduate level on sensory integration and regularly supervises OT students.",
    testimonials: [
      {
        quote: "Exactly the level of depth I needed — clear, clinical, practical.",
        author: "Niamh Walsh",
        role: "Occupational Therapist",
      },
    ],
    modules: [
      "Tactile system — more than touch",
      "Vestibular system — movement and gravity",
      "Proprioception — the 'position' sense",
      "Interoception — reading the body within",
      "The traditional five — through an OT lens",
      "Putting it together in clinical practice",
    ],
  },
  {
    slug: "calm-mornings-bedtime-routines",
    title: "Calm Mornings, Calmer Bedtimes",
    audience: "Parents and carers",
    duration: "60 minutes",
    level: "Beginner",
    price: 29,
    tagline: "Transform the two hardest parts of the day with sensory-savvy routines.",
    shortDescription:
      "A short, focused course with ready-to-use morning and bedtime routines built on sensory regulation principles.",
    description:
      "If mornings and bedtimes feel like a battle every day, this course is for you. Four short modules give you the principles and the exact routines — with visual schedules, alerting/calming activities, and troubleshooting for the most common sticking points.",
    features: [
      "Morning routine template you can print and stick on the fridge",
      "Calming wind-down routine for bedtime",
      "Why sensory input matters at transitions",
      "What to do when the routine falls apart",
    ],
    imagePrompt:
      "Children's book illustration, soft flat cartoon, a parent helping a child into pyjamas with a warm lamp glowing, calm muted blues and warm creams, plush bear on the bed, no text, clean cosy background",
    instructorName: "Grace Magennis",
    instructorRole: "Paediatric Occupational Therapist",
    instructorBio:
      "Grace has spent ten-plus years helping families rescue their mornings and bedtimes.",
    testimonials: [
      {
        quote:
          "Saved our household. Bedtime used to take 90 minutes — now it's 20.",
        author: "Sarah, parent of twins",
      },
    ],
    modules: [
      "Why routines break down",
      "The morning routine that works",
      "The bedtime wind-down",
      "Troubleshooting — common sticking points",
    ],
  },
];

function replicate() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set");
  return new Replicate({ auth: token });
}

async function runFlux(prompt: string): Promise<string> {
  const client = replicate();
  const output = (await client.run("black-forest-labs/flux-schnell", {
    input: {
      prompt,
      num_outputs: 1,
      output_format: "webp",
      output_quality: 90,
      aspect_ratio: "16:9",
    },
  })) as unknown;

  function firstUrl(v: unknown): string | null {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) {
      for (const x of v) {
        const u = firstUrl(x);
        if (u) return u;
      }
      return null;
    }
    if (typeof v === "object") {
      const obj = v as { url?: unknown };
      if (typeof obj.url === "function") {
        try {
          const r = (obj.url as () => unknown)();
          if (typeof r === "string") return r;
          if (r && typeof (r as URL).toString === "function")
            return (r as URL).toString();
        } catch {
          /* ignore */
        }
      }
      if (typeof obj.url === "string") return obj.url;
    }
    return null;
  }
  const url = firstUrl(output);
  if (!url) throw new Error("Replicate returned no URL");
  return url;
}

async function rehost(sourceUrl: string, filename: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const key = `course-covers/${Date.now()}-${filename}`;
  const { url } = await put(key, Buffer.from(buf), {
    access: "public",
    addRandomSuffix: true,
    contentType: res.headers.get("content-type") ?? "image/webp",
  });
  return url;
}

async function main() {
  // Make sure nav_courses won't be needed in the sidebar template — the
  // public storefront is at /courses and doesn't live in the admin sidebar.
  // Just seed courses.
  const owner = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (!owner) {
    console.error("No SUPER_ADMIN user found — can't attribute courses. Exiting.");
    return;
  }

  for (const c of COURSES) {
    const existing = await prisma.course.findUnique({ where: { slug: c.slug } });
    if (existing) {
      console.log(`↷ ${c.slug} already exists — skipping`);
      continue;
    }

    console.log(`→ Generating cover for ${c.slug}…`);
    let heroUrl = "";
    try {
      const flux = await runFlux(c.imagePrompt);
      heroUrl = await rehost(flux, `${c.slug}.webp`);
      console.log(`  ✓ hero image ${heroUrl.slice(0, 80)}…`);
    } catch (err) {
      console.error(`  ✗ image failed — continuing without one`, err);
    }

    const created = await prisma.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        audience: c.audience,
        duration: c.duration,
        description: c.description,
        price: c.price,
        status: "AVAILABLE",
        order: 0,
        tagline: c.tagline,
        shortDescription: c.shortDescription,
        level: c.level,
        features: c.features,
        heroImageUrl: heroUrl || null,
        thumbnailUrl: heroUrl || null,
        isFeatured: c.isFeatured === true,
        isBestseller: c.isBestseller === true,
        instructorName: c.instructorName,
        instructorRole: c.instructorRole,
        instructorBio: c.instructorBio,
        testimonials: c.testimonials as unknown as object,
      },
    });

    await prisma.$transaction(
      c.modules.map((title, idx) =>
        prisma.module.create({
          data: {
            courseId: created.id,
            title,
            order: idx,
            // Empty content/questions — course builder lands in a follow-up.
            content: { sections: [] } as unknown as object,
            questions: [] as unknown as object,
          },
        }),
      ),
    );

    console.log(`✓ Seeded ${c.title} (${c.modules.length} modules)`);
    // Breather between runs so Replicate's burst throttle doesn't trip us.
    await new Promise((r) => setTimeout(r, 1200));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
