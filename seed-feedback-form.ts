/**
 * Recreate the "Assessment Feedback Form" from the existing Google Form
 * (https://docs.google.com/forms/d/e/1FAIpQLSdjJlj57sl0I3iXISpKSGOYVEJCl61BGvEY4CBuhKIodcKPKw/viewform)
 * inside our own forms feature, so feedback responses live in the app's DB
 * (and clients hit a sensory.aiworldexperts.com link instead of a Google one).
 *
 * Idempotent — re-running upserts on slug. Typos in the original form
 * (Statisfied → Satisfied, Neurtral → Neutral, Exellent → Excellent,
 * "How Satisfies" → "How satisfied") have been corrected because there's no
 * benefit to preserving them when we're moving to a new system.
 *
 * Usage:
 *   node _run-with-env.js npx tsx ./seed-feedback-form.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "assessment-feedback";
const CREATOR_EMAIL = "patrick@thesensorysubmarine.com";

interface Field {
  id: string;
  type: "short_text" | "long_text" | "radio";
  label: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

const RATING_5_EASE = ["Very Easy", "Easy", "Neutral", "Difficult", "Very Difficult"];
const RATING_5_QUALITY = ["Excellent", "Good", "Fair", "Poor", "Very Poor"];
const RATING_5_SATISFACTION = ["Very Satisfied", "Satisfied", "Neutral", "Unsatisfied", "Very Unsatisfied"];
const RATING_6_OVERALL = ["Excellent", "Very Good", "Good", "Fair", "Poor", "Very Poor"];

const opts = (labels: string[]): { label: string; value: string }[] =>
  labels.map((l) => ({ label: l, value: l }));

const fields: Field[] = [
  {
    id: "booking_process",
    type: "radio",
    label: "How would you rate the booking process?",
    required: true,
    options: opts(RATING_5_EASE),
  },
  {
    id: "assessment_location",
    type: "short_text",
    label: "Please tell us where your assessment took place",
    required: true,
  },
  {
    id: "venue_rating",
    type: "radio",
    label: "How would you rate the venue?",
    required: true,
    options: opts(RATING_5_QUALITY),
  },
  {
    id: "therapist_name",
    type: "short_text",
    label: "Please tell us the name of the therapist who carried out your assessment",
    required: true,
  },
  {
    id: "therapist_satisfaction",
    type: "radio",
    label: "How satisfied were you with your Occupational Therapist?",
    required: true,
    options: opts(RATING_5_SATISFACTION),
  },
  {
    id: "home_programme_speed",
    type: "radio",
    label: "How satisfied were you with how quickly you received your home programme?",
    required: true,
    options: opts(RATING_5_SATISFACTION),
  },
  {
    id: "overall_rating",
    type: "radio",
    label: "Overall, how would you rate your assessment experience?",
    required: true,
    options: opts(RATING_6_OVERALL),
  },
  {
    id: "would_recommend",
    type: "radio",
    label: "Would you recommend The Sensory Submarine to other families?",
    required: true,
    options: opts(["Yes", "No"]),
  },
  {
    id: "comments",
    type: "long_text",
    label: "Please tell us what you thought of your assessment and any additional comments",
    required: true,
  },
];

async function main() {
  const creator = await prisma.user.findUnique({ where: { email: CREATOR_EMAIL } });
  if (!creator) {
    throw new Error(
      `Creator user "${CREATOR_EMAIL}" not found. Update CREATOR_EMAIL in this script to a real staff user.`,
    );
  }

  const title = "Assessment Feedback Form";
  const description =
    "Thank you for attending your assessment with The Sensory Submarine. " +
    "We'd really value your feedback to help us continue providing high-quality, supportive services for families.";

  const settings = {
    submitButtonText: "Submit feedback",
    successMessage:
      "Thank you for your feedback — it really helps us keep improving the service for families.",
    notifyEmails: [CREATOR_EMAIL],
  };

  const existing = await prisma.form.findUnique({ where: { slug: SLUG } });

  if (existing) {
    const updated = await prisma.form.update({
      where: { slug: SLUG },
      data: {
        title,
        description,
        fields: fields as unknown as object,
        settings: settings as unknown as object,
        isPublished: true,
      },
    });
    console.log(`✓ Updated existing form "${updated.title}" (${updated.id})`);
  } else {
    const created = await prisma.form.create({
      data: {
        title,
        slug: SLUG,
        description,
        fields: fields as unknown as object,
        settings: settings as unknown as object,
        isPublished: true,
        createdById: creator.id,
      },
    });
    console.log(`✓ Created form "${created.title}" (${created.id})`);
  }

  console.log(`\nPublic URL:  https://sensory.aiworldexperts.com/f/${SLUG}`);
  console.log(`Admin edit:  https://sensory.aiworldexperts.com/forms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
