/**
 * Seeds the Activity Bank with 65 activities ported from Grace's
 * `ACTIVITY BANK.docx` (in /Users/patrickfarren/The Sensory/home-programmes/).
 *
 * Each row maps onto the existing Activity model:
 *   name        → "⭐ Dinosaur Crash Zone"  →  "Dinosaur Crash Zone"
 *   description → the activity blurb
 *   category    → e.g. "PROPRIOCEPTIVE"
 *   targetArea  → string[] (e.g. ["Regulation", "Body Awareness", "Strength"])
 *   ageRange    → string?  (e.g. "2–8")
 *   equipment   → string[] (e.g. ["Cushions", "crash mats"])
 *
 * Idempotent — upserts on name. Re-running after Grace tweaks the
 * docx + re-runs the script just refreshes content.
 *
 * Usage:
 *   node _run-with-env.js npx tsx ./seed-activity-bank.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ActivitySeed {
  name: string;
  description: string;
  category: string;
  targetArea: string[];
  ageRange?: string;
  equipment?: string[];
}

const ACTIVITIES: ActivitySeed[] = [
  // ── PROPRIOCEPTIVE (HEAVY WORK / BODY AWARENESS) ────────────────────
  {
    name: "Dinosaur Crash Zone",
    category: "PROPRIOCEPTIVE",
    description:
      "Jump, stomp and crash into cushions or beanbags like a giant T-Rex. Add missions like \"save the dinosaur eggs\" or \"escape the volcano.\"",
    targetArea: ["Regulation", "Body Awareness", "Strength"],
    ageRange: "2–8",
    equipment: ["Cushions", "Crash mats"],
  },
  {
    name: "Toy Delivery Service",
    category: "PROPRIOCEPTIVE",
    description:
      "Carry \"important deliveries\" (toys, books, cushions) across the room or house. Turn it into a mission (e.g., \"deliver supplies to the Octonauts\").",
    targetArea: ["Heavy Work", "Organisation", "Motor Planning"],
    ageRange: "2–10",
    equipment: ["Toys", "Bags", "Boxes"],
  },
  {
    name: "Human Bulldozer",
    category: "PROPRIOCEPTIVE",
    description:
      "Push a large laundry basket filled with toys across the room like a bulldozer. Add ramps or obstacles.",
    targetArea: ["Upper Body Strength", "Coordination", "Regulation"],
    ageRange: "3–10",
    equipment: ["Laundry basket"],
  },
  {
    name: "Burrito Roll Squeeze",
    category: "PROPRIOCEPTIVE / CALMING",
    description:
      "Roll the child up tightly in a blanket (\"dinosaur burrito\") and apply firm pressure (avoid head).",
    targetArea: ["Calming", "Body Awareness"],
    ageRange: "2–8",
    equipment: ["Blanket"],
  },
  {
    name: "Animal Rescue Tug",
    category: "PROPRIOCEPTIVE",
    description:
      "Pull toys across the floor using a rope or towel. Pretend they are stuck in mud or lava.",
    targetArea: ["Strength", "Coordination", "Engagement"],
    ageRange: "3–10",
    equipment: ["Rope or towel", "Toys"],
  },

  // ── VESTIBULAR (MOVEMENT & BALANCE) ─────────────────────────────────
  {
    name: "Rocket Ship Launch",
    category: "VESTIBULAR",
    description:
      "Squat down then jump up like a rocket blasting into space. Add countdowns.",
    targetArea: ["Balance", "Coordination", "Alerting"],
    ageRange: "2–8",
  },
  {
    name: "Swinging Adventures",
    category: "VESTIBULAR",
    description:
      "Use a swing for themed play (flying dinosaurs, underwater missions). Forward/back = calming, spinning = alerting.",
    targetArea: ["Regulation", "Balance"],
    ageRange: "2–10",
    equipment: ["Swing"],
  },
  {
    name: "Log Roll Race",
    category: "VESTIBULAR",
    description:
      "Roll across the floor like a rolling log or \"sausage.\" Race toys or family members.",
    targetArea: ["Body Awareness", "Coordination"],
    ageRange: "2–8",
    equipment: ["Mat"],
  },
  {
    name: "Pirate Balance Walk",
    category: "VESTIBULAR",
    description:
      "Walk along a \"plank\" (tape/beam). Don't fall into the \"shark water!\"",
    targetArea: ["Balance", "Motor Planning"],
    ageRange: "3–10",
    equipment: ["Tape or beam"],
  },

  // ── TACTILE (TOUCH) ─────────────────────────────────────────────────
  {
    name: "Dinosaur Dig Site",
    category: "TACTILE",
    description:
      "Hide dinosaurs in sand, rice or soil and dig them out using hands or tools.",
    targetArea: ["Tactile Processing", "Exploration"],
    ageRange: "2–8",
    equipment: ["Sensory bin"],
  },
  {
    name: "Messy Monster Lab",
    category: "TACTILE",
    description:
      "Mix slime, foam or gloop to create \"monster potions.\" Add colours and toys.",
    targetArea: ["Sensory Tolerance", "Creativity"],
    ageRange: "3–10",
    equipment: ["Foam", "Slime"],
  },
  {
    name: "Car Wash Station",
    category: "TACTILE",
    description: "Wash toy cars/animals with sponges and bubbles.",
    targetArea: ["Tactile Exposure", "Fine Motor"],
    ageRange: "2–8",
    equipment: ["Water", "Soap", "Toys"],
  },
  {
    name: "Mystery Treasure Bag",
    category: "TACTILE",
    description:
      "Feel objects inside a bag and guess what they are without looking.",
    targetArea: ["Tactile Discrimination", "Language"],
    ageRange: "3–10",
    equipment: ["Bag", "Objects"],
  },

  // ── AUDITORY ────────────────────────────────────────────────────────
  {
    name: "Musical Freeze Party",
    category: "AUDITORY",
    description: "Dance and freeze when music stops. Add silly poses or emotions.",
    targetArea: ["Auditory Processing", "Impulse Control"],
    ageRange: "3–8",
    equipment: ["Music"],
  },
  {
    name: "Sound Safari",
    category: "AUDITORY",
    description:
      "Go on a \"listening walk\" and identify sounds (birds, cars, wind).",
    targetArea: ["Auditory Awareness", "Attention"],
    ageRange: "3–10",
    equipment: ["Outdoor space"],
  },
  {
    name: "Copy the Beat Drum Game",
    category: "AUDITORY",
    description: "Tap rhythms and have the child copy them.",
    targetArea: ["Auditory Memory", "Attention"],
    ageRange: "3–10",
    equipment: ["Drum or table"],
  },

  // ── VISUAL ──────────────────────────────────────────────────────────
  {
    name: "Torch Treasure Hunt",
    category: "VISUAL",
    description: "Use a torch in a dark room to find hidden toys.",
    targetArea: ["Visual Tracking", "Scanning"],
    ageRange: "3–8",
    equipment: ["Torch"],
  },
  {
    name: "Bubble Pop Challenge",
    category: "VISUAL",
    description: "Track and pop bubbles—add counting or colour naming.",
    targetArea: ["Visual Tracking", "Coordination"],
    ageRange: "2–6",
    equipment: ["Bubbles"],
  },

  // ── ORAL MOTOR / GUSTATORY ──────────────────────────────────────────
  {
    name: "Blow Football",
    category: "ORAL MOTOR / GUSTATORY",
    description: "Blow pom poms across a table using a straw to score goals.",
    targetArea: ["Breathing Control", "Oral Strength"],
    ageRange: "3–8",
    equipment: ["Straws", "Pom poms"],
  },
  {
    name: "Crunch & Chew Snack Time",
    category: "ORAL MOTOR / GUSTATORY",
    description: "Offer crunchy/chewy foods during play or before focus tasks.",
    targetArea: ["Regulation", "Oral Input"],
    ageRange: "3+",
    equipment: ["Snacks"],
  },

  // ── INTEROCEPTION ───────────────────────────────────────────────────
  {
    name: "Engine Check-In",
    category: "INTEROCEPTION",
    description: "Ask \"Is your engine fast or slow?\" and match activities to needs.",
    targetArea: ["Self-Awareness", "Regulation"],
    ageRange: "3–10",
  },
  {
    name: "Body Detective",
    category: "INTEROCEPTION",
    description: "Identify body signals (hungry, tired, hot, cold).",
    targetArea: ["Body Awareness"],
    ageRange: "4–10",
  },
  {
    name: "Teddy Bear Breathing",
    category: "INTEROCEPTION / CALMING",
    description:
      "Lie on back and place a favourite teddy or soft toy on the tummy. Breathe in slowly to make the teddy rise, then breathe out to watch it fall. You can add a story (e.g., \"rocking teddy to sleep\").",
    targetArea: ["Body Awareness", "Breathing Control", "Emotional Regulation"],
    ageRange: "2–8",
    equipment: ["Soft toy"],
  },
  {
    name: "Expandaball Breathing",
    category: "INTEROCEPTION / REGULATION",
    description:
      "Use an expandaball to visually show breathing—open it slowly for \"breathe in\" and close for \"breathe out.\" Great for modelling pacing and rhythm.",
    targetArea: ["Breathing Awareness", "Self-Regulation"],
    ageRange: "3–10",
    equipment: ["Expandaball"],
  },
  {
    name: "Bubble Breathing",
    category: "INTEROCEPTION / CALMING",
    description:
      "Blow bubbles slowly and gently, focusing on long, controlled breaths. Encourage \"big slow breaths to make BIG bubbles.\"",
    targetArea: ["Breathing Control", "Regulation"],
    ageRange: "2–8",
    equipment: ["Bubbles"],
  },
  {
    name: "Hot Chocolate Breathing",
    category: "INTEROCEPTION",
    description:
      "Pretend to hold a cup of hot chocolate—breathe in to \"smell it\" and blow out gently to \"cool it down.\"",
    targetArea: ["Breathing Awareness", "Calming"],
    ageRange: "3–8",
    equipment: ["Pretend cup (optional)"],
  },
  {
    name: "Body Scan Game",
    category: "INTEROCEPTION",
    description:
      "Guide the child to notice different parts of their body: \"Can you feel your feet? Your tummy? Your hands?\" Can turn into a game like \"wake up your body.\"",
    targetArea: ["Body Awareness", "Mindfulness"],
    ageRange: "4–10",
  },
  {
    name: "Feelings Detective",
    category: "INTEROCEPTION",
    description:
      "Talk about how emotions feel in the body: \"Where do you feel excited? Where do you feel nervous?\" You can draw body outlines and colour in feelings.",
    targetArea: ["Emotional Awareness", "Body Mapping"],
    ageRange: "4–10",
    equipment: ["Paper", "Crayons"],
  },
  {
    name: "Thirst & Hunger Check-In",
    category: "INTEROCEPTION",
    description:
      "Pause during the day and ask simple questions: \"Is your tummy empty or full?\" \"Do you need a drink?\"",
    targetArea: ["Internal Body Awareness", "Self-Care Skills"],
    ageRange: "3–10",
  },
  {
    name: "Heartbeat Hunt",
    category: "INTEROCEPTION",
    description:
      "After jumping or running, place hands on chest to feel heartbeat. Compare \"fast\" vs \"slow.\"",
    targetArea: ["Body Awareness", "Cause & Effect"],
    ageRange: "3–10",
  },
  {
    name: "Temperature Check Game",
    category: "INTEROCEPTION",
    description:
      "Notice body temperature: \"Are you hot or cold?\" Pair with actions (take jumper off, get a drink, rest).",
    targetArea: ["Self-Awareness", "Regulation"],
    ageRange: "3–10",
  },
  {
    name: "Toilet Body Signals Game",
    category: "INTEROCEPTION",
    description:
      "Talk about signs like \"full tummy,\" \"tight feeling,\" or \"pressure.\" Use visuals or simple language to build awareness in a low-pressure way.",
    targetArea: ["Toileting Awareness", "Interoception"],
    ageRange: "3–8",
    equipment: ["Visuals (optional)"],
  },
  {
    name: "Sleepy Signals Game",
    category: "INTEROCEPTION",
    description:
      "Before bed, ask: \"Are your eyes heavy? Is your body slow?\" Help link body cues to sleep readiness.",
    targetArea: ["Sleep Awareness", "Regulation"],
    ageRange: "3–8",
  },
  {
    name: "Energy Meter Game",
    category: "INTEROCEPTION",
    description:
      "Use a visual scale (low → high energy). Match activities to the level (jumping vs calming).",
    targetArea: ["Self-Regulation", "Awareness"],
    ageRange: "4–10",
    equipment: ["Visual scale (optional)"],
  },

  // ── CORE & POSTURAL ─────────────────────────────────────────────────
  {
    name: "Superhero Flying",
    category: "CORE & POSTURAL",
    description: "Lie on tummy and lift arms/legs like flying.",
    targetArea: ["Core Strength", "Postural Control"],
    ageRange: "2–8",
  },
  {
    name: "Wheelbarrow Walk Challenge",
    category: "CORE & POSTURAL",
    description: "Walk on hands while adult holds legs. Add obstacle courses.",
    targetArea: ["Strength", "Coordination"],
    ageRange: "3–8",
  },
  {
    name: "Peanut Ball Superhero Reach",
    category: "CORE & POSTURAL",
    description:
      "Child lies on tummy over a peanut ball and reaches forward to collect toys (\"save the superheroes\" / \"rescue sea animals\"). Roll gently forward and back. Provide support at hips/trunk.",
    targetArea: ["Core Strength", "Shoulder Stability", "Postural Control"],
    ageRange: "2–8",
    equipment: ["Peanut ball", "Toys"],
  },
  {
    name: "Peanut Ball Row Row Game",
    category: "CORE & POSTURAL",
    description:
      "Sit child on peanut ball facing you and gently rock forward/back while singing \"Row Row Row Your Boat.\" Can hold hands for stability.",
    targetArea: ["Core Activation", "Balance", "Regulation"],
    ageRange: "2–6",
    equipment: ["Peanut ball"],
  },
  {
    name: "Tunnel Treasure Crawl",
    category: "CORE & POSTURAL",
    description:
      "Crawl through tunnels (or under chairs/blankets) to collect puzzle pieces or toys. Add missions like \"find all the dinosaurs.\"",
    targetArea: ["Core Strength", "Motor Planning", "Coordination"],
    ageRange: "2–8",
    equipment: ["Tunnel or homemade setup"],
  },
  {
    name: "Commando Crawl Mission",
    category: "CORE & POSTURAL",
    description:
      "Army crawl on tummy under \"laser beams\" (string/tape) or furniture. Keep tummy low to the ground.",
    targetArea: ["Core Strength", "Upper Body Strength", "Body Awareness"],
    ageRange: "3–8",
    equipment: ["Floor space", "String or tape"],
  },
  {
    name: "Tummy Time Art Station",
    category: "CORE & POSTURAL",
    description:
      "Lie on tummy while colouring, drawing, or doing puzzles. Can use books or wedge to support if needed.",
    targetArea: ["Core Endurance", "Shoulder Stability"],
    ageRange: "2–7",
    equipment: ["Paper", "Crayons"],
  },
  {
    name: "Bridge Tunnel Game",
    category: "CORE & POSTURAL",
    description:
      "Child lies on back, lifts hips into a bridge while toys (cars/trains) go underneath. Try holding for longer or repeating.",
    targetArea: ["Core Strength", "Glute Strength", "Postural Control"],
    ageRange: "3–8",
    equipment: ["Toys"],
  },
  {
    name: "Wheelbarrow Walk Rescue",
    category: "CORE & POSTURAL",
    description:
      "Adult holds child's legs while they walk on hands to \"rescue toys.\" Can add obstacles or targets.",
    targetArea: ["Core Strength", "Shoulder Stability", "Coordination"],
    ageRange: "3–8",
    equipment: ["Toys"],
  },
  {
    name: "Sitting Balance Pop Game",
    category: "CORE & POSTURAL",
    description:
      "Sit on a stool, peanut ball or cushion and reach to pop bubbles or collect items from different heights/directions.",
    targetArea: ["Postural Control", "Balance", "Reaching Skills"],
    ageRange: "2–8",
    equipment: ["Bubbles", "Stool or ball"],
  },
  {
    name: "Superman Freeze Challenge",
    category: "CORE & POSTURAL",
    description:
      "Lie on tummy and lift arms/legs (\"flying superhero\"). Hold for a count or play \"freeze.\"",
    targetArea: ["Core Strength", "Postural Endurance"],
    ageRange: "3–8",
  },
  {
    name: "Crawl & Push Obstacle Course",
    category: "CORE & POSTURAL",
    description:
      "Combine crawling through tunnels, pushing objects, and climbing over cushions into one continuous course.",
    targetArea: ["Core Strength", "Motor Planning", "Coordination"],
    ageRange: "2–10",
    equipment: ["Cushions", "Tunnels"],
  },
  {
    name: "Seated Reaching Tower",
    category: "CORE & POSTURAL",
    description:
      "Sit on a low stool or bench and reach to build a tower with blocks placed slightly out of reach (high/low/side).",
    targetArea: ["Postural Control", "Balance", "Upper Body Coordination"],
    ageRange: "2–8",
    equipment: ["Blocks"],
  },
  {
    name: "Peanut Ball Belly Bounces",
    category: "CORE & POSTURAL",
    description:
      "Child lies on tummy over peanut ball and gently bounces while holding onto surface or adult. Keep controlled and safe.",
    targetArea: ["Core Activation", "Alerting Input"],
    ageRange: "2–6",
    equipment: ["Peanut ball"],
  },

  // ── GROSS MOTOR ─────────────────────────────────────────────────────
  {
    name: "Obstacle Course Adventure",
    category: "GROSS MOTOR",
    description: "Crawl, jump, climb and balance through themed courses.",
    targetArea: ["Motor Planning", "Coordination"],
    ageRange: "2–10",
  },
  {
    name: "Balloon Volleyball",
    category: "GROSS MOTOR",
    description: "Hit balloon back and forth without letting it drop.",
    targetArea: ["Coordination", "Timing"],
    ageRange: "3–10",
  },
  {
    name: "Traffic Light Run Game",
    category: "GROSS MOTOR",
    description:
      "Child moves around the space based on cues: Green = run, Yellow = walk, Red = stop. Add variations like \"reverse,\" \"jump,\" or \"spin\" to keep it fun and unpredictable.",
    targetArea: ["Impulse Control", "Listening Skills", "Coordination"],
    ageRange: "3–8",
  },
  {
    name: "Animal Parade Adventure",
    category: "GROSS MOTOR",
    description:
      "Move around like different animals—stomp like a dinosaur, hop like a frog, slither like a snake. You can turn it into a parade or follow-the-leader game.",
    targetArea: ["Coordination", "Strength", "Motor Planning"],
    ageRange: "2–8",
  },
  {
    name: "Beanbag Target Toss",
    category: "GROSS MOTOR",
    description:
      "Throw beanbags (or soft toys) into boxes, hoops, or targets. Vary distance and height to grade difficulty.",
    targetArea: ["Hand-Eye Coordination", "Motor Planning"],
    ageRange: "3–10",
    equipment: ["Beanbags", "Boxes"],
  },
  {
    name: "Jump the River",
    category: "GROSS MOTOR",
    description:
      "Use two lines (tape/ropes) as a \"river.\" Child jumps across—make it wider or add \"crocodiles\" for fun.",
    targetArea: ["Balance", "Coordination", "Power"],
    ageRange: "3–8",
    equipment: ["Tape or rope"],
  },

  // ── FINE MOTOR ──────────────────────────────────────────────────────
  {
    name: "Hungry Tennis Ball",
    category: "FINE MOTOR",
    description:
      "Stick googly eyes to a tennis ball and cut a mouth — feed pom poms into a tennis ball mouth.",
    targetArea: ["Hand Strength", "Grasp"],
    ageRange: "3–8",
  },
  {
    name: "Spray Bottle Rescue",
    category: "FINE MOTOR",
    description: "Spray water to \"rescue\" toys or put out pretend fires.",
    targetArea: ["Hand Strength", "Control"],
    ageRange: "3–8",
  },
  {
    name: "Treasure Tweezers Hunt",
    category: "FINE MOTOR",
    description:
      "Use tweezers or tongs to pick up small objects (pom poms, beads, \"treasures\") and sort into containers.",
    targetArea: ["Pincer Grip", "Hand Strength", "Coordination"],
    ageRange: "3–8",
    equipment: ["Tweezers", "Small objects"],
  },
  {
    name: "Sticker Rescue Mission",
    category: "FINE MOTOR",
    description:
      "Peel stickers off a surface (table, paper, tape) and place them onto a \"rescue board\" or picture.",
    targetArea: ["Finger Strength", "Dexterity", "Bilateral Coordination"],
    ageRange: "2–6",
    equipment: ["Stickers"],
  },
  {
    name: "Peg the Washing Line",
    category: "FINE MOTOR",
    description:
      "Hang small items (socks, pictures) onto a string using pegs—turn it into a game (e.g., \"hang the dinosaur clothes\").",
    targetArea: ["Hand Strength", "Coordination", "Grip"],
    ageRange: "3–8",
    equipment: ["Pegs", "String"],
  },
  {
    name: "Nut & Bolt Builders",
    category: "FINE MOTOR",
    description:
      "Screw and unscrew nuts and bolts or containers—can be turned into a building or fixing game.",
    targetArea: ["Hand Strength", "Rotation Skills", "Coordination"],
    ageRange: "3–8",
    equipment: ["Nuts and bolts or containers"],
  },
  {
    name: "Post the Letters",
    category: "FINE MOTOR",
    description:
      "Post cards, shapes, or coins into slots (boxes, tins). Can turn into a \"post office\" role play.",
    targetArea: ["Hand-Eye Coordination", "Dexterity"],
    ageRange: "2–6",
    equipment: ["Box with slot", "Cards"],
  },

  // ── HANDWRITING ─────────────────────────────────────────────────────
  {
    name: "Window Writing",
    category: "HANDWRITING",
    description: "Draw on vertical surfaces.",
    targetArea: ["Shoulder Stability", "Control"],
    ageRange: "3–8",
  },
  {
    name: "Sand Tray Letters",
    category: "HANDWRITING",
    description: "Write letters in sand or foam.",
    targetArea: ["Pre-writing Skills"],
    ageRange: "3–7",
  },

  // ── FUNCTIONAL SKILLS ───────────────────────────────────────────────
  {
    name: "Bedtime Burrito",
    category: "FUNCTIONAL SKILLS",
    description: "Deep pressure cuddles or blanket wrap before bed.",
    targetArea: ["Calming"],
  },
  {
    name: "Build-a-Snack",
    category: "FUNCTIONAL SKILLS",
    description: "Make snacks independently (wraps, crackers).",
    targetArea: ["Independence", "Fine Motor"],
  },
  {
    name: "Bubble Toileting Routine",
    category: "FUNCTIONAL SKILLS",
    description: "Blow bubbles while sitting to relax body.",
    targetArea: ["Relaxation", "Interoception"],
  },
  {
    name: "Dressing Race Game",
    category: "FUNCTIONAL SKILLS",
    description: "Race to put on clothes or dress toys.",
    targetArea: ["Independence", "Motor Planning"],
  },
];

/**
 * Title-case a category string so categories stay consistent
 * regardless of how a contributor types them in the data array
 * ("TACTILE" vs "Tactile" vs "tactile" all become "Tactile"). Prevents
 * the case-duplicate filter chips Grace flagged on 19 May 2026.
 */
function normaliseCategory(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const a of ACTIVITIES) {
    // Idempotent on name. Re-runs refresh content without dupes.
    const existing = await prisma.activity.findFirst({
      where: { name: a.name },
      select: { id: true },
    });

    const data = {
      name: a.name,
      description: a.description,
      category: normaliseCategory(a.category),
      targetArea: a.targetArea,
      ageRange: a.ageRange ?? null,
      equipment: a.equipment ?? [],
    };

    if (existing) {
      await prisma.activity.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.activity.create({ data });
      created++;
    }
  }

  // Quick summary by category.
  const counts: Record<string, number> = {};
  for (const a of ACTIVITIES) counts[a.category] = (counts[a.category] ?? 0) + 1;

  console.log(`Done. ${created} created, ${updated} updated.\n`);
  console.log("Activities by category:");
  for (const [cat, n] of Object.entries(counts).sort()) {
    console.log(`  ${cat.padEnd(35)} ${n}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
