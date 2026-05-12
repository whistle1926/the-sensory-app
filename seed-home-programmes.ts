/**
 * Seeds 7 ready-made home-programme templates supplied by Grace, ported
 * from /Users/patrickfarren/The Sensory/home-programmes/HOME PROGRAMMES.docx.
 *
 * Each programme = a ProgrammeTemplate row with structured `sections`
 * (Overview / What you might notice / strategies / progression / etc.)
 * matching the existing UI conventions in src/app/(app)/programmes.
 *
 * Idempotent — upserts on title, so re-running just refreshes content
 * without creating duplicates. New programmes append to the end of the
 * existing orderIndex sequence.
 *
 * Usage:
 *   node _run-with-env.js npx tsx ./seed-home-programmes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SectionSeed {
  title: string;
  items: string[];
}

interface ProgrammeSeed {
  title: string;
  description: string;
  sections: SectionSeed[];
}

const PROGRAMMES: ProgrammeSeed[] = [
  // ────────────────────────────────────────────────────────────────────
  // 1. MOVEMENT SEEKERS
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Movement Seekers",
    description:
      "Vestibular + proprioceptive seeking. Some children have a big sensory cup for movement — they need more input than others to feel settled and organised. Without enough movement, their body feels busy, leading to constant movement, crashing, climbing or difficulty sitting still. This is not behaviour — it is the nervous system trying to regulate itself.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Constant movement (running, jumping, spinning)",
          "Crashing into people or furniture",
          "Difficulty sitting still",
          "Seeking rough and tumble play",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Provide regular, structured movement input throughout the day so the child does not need to seek it in unsafe or disruptive ways.",
        ],
      },
      {
        title: "🌅 Morning (before school)",
        items: [
          "Jumping (trampoline, jumping off a step)",
          "Animal walks to the bathroom or kitchen",
          "Carrying heavy items (school bag, books)",
          "Rolling over a peanut ball",
          "💡 Why: prepares the brain for attention and learning by 'filling the sensory cup' early.",
        ],
      },
      {
        title: "🏫 School strategies",
        items: [
          "Scheduled movement breaks (not just when dysregulated)",
          "Heavy work jobs (carrying books, moving equipment)",
          "Resistance input (chair bands, wall push-ups)",
          "Access to fidgets",
          "💡 Why: prevents build-up of sensory need which can lead to loss of focus or behaviour challenges.",
        ],
      },
      {
        title: "🌇 After school",
        items: [
          "Outdoor play (running, climbing, scootering)",
          "Obstacle courses (crawl, jump, crash)",
          "Swinging (linear, calming)",
          "💡 Why: releases sensory build-up from structured environments.",
        ],
      },
      {
        title: "🌙 Evening",
        items: [
          "Heavy work (pushing cushions, crawling upstairs)",
          "Deep pressure (blanket burrito, massage)",
          "Slow rhythmic movement",
          "💡 Why: supports transition from alert → calm for sleep.",
        ],
      },
      {
        title: "Progression",
        items: [
          "Start with frequent, short bursts.",
          "Build awareness — 'What helps your body feel calm?'",
          "Gradually support independence in choosing activities.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // 2. SENSORY EATERS
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Sensory Eaters",
    description:
      "Eating is one of the most complex sensory tasks we do — there are 32 steps involved in eating. Children may avoid foods due to texture, smell, appearance or previous negative experiences. What looks like 'fussy eating' is often sensory protection.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Limited range of foods",
          "Strong reactions to textures (e.g. gagging)",
          "Avoiding mixed or new foods",
          "Preferring the same foods repeatedly",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Reduce anxiety and increase comfort, confidence and curiosity around food.",
        ],
      },
      {
        title: "🍴 Mealtime environment",
        items: [
          "Calm, predictable setup",
          "Same seating position (feet supported flat on floor or on a stool/box)",
          "Reduce pressure and distractions",
          "Have a small bag of fidgets at mealtimes — a distraction and a source of sensory feedback while eating",
          "Reduce food smells — open windows when cooking",
          "Reduce clutter; keep the environment calm",
          "💡 Why: when the nervous system feels safe, children are more open to trying foods.",
        ],
      },
      {
        title: "🍽️ Mealtime approach",
        items: [
          "Always include a preferred food",
          "Introduce new foods alongside familiar ones — compartment plates, or a side plate nearby with a small amount of new food",
          "Use language like: 'You don't have to eat it, just having it on your plate is great.'",
          "No pressure to try new foods — visually tolerating it is the first step. Consistency and frequent exposure is key.",
          "💡 Why: reduces pressure and builds trust.",
        ],
      },
      {
        title: "🎉 Food play",
        items: [
          "Explore foods without expectation of eating",
          "Build shapes, faces or stories with food",
          "Messy play with food bases — oats, rice, pasta. Hide a few favourite small toys; encourage scooping, pouring, hiding, crunching. Always have scoops + a quick way to wash hands nearby.",
          "Touch, smell, squish",
          "💡 Why: repeated exposure builds familiarity, which leads to acceptance.",
        ],
      },
      {
        title: "🥤 Oral preparation",
        items: [
          "Blowing, sucking, chewing before meals",
          "Crunchy snacks to 'wake up' the mouth",
        ],
      },
      {
        title: "Progression",
        items: [
          "Looking → touching → tasting → eating.",
          "Celebrate all steps, not just eating.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // 3. ORAL SENSORY SEEKING
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Oral Sensory Seeking",
    description:
      "The mouth is a powerful regulator. Children may chew or mouth objects to calm themselves, stay alert, or manage anxiety. This programme provides safe, appropriate oral input and reduces unsafe behaviours.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Chewing clothes, pencils, toys",
          "Putting non-food items in the mouth",
          "Seeking strong flavours or textures",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Provide safe, appropriate oral input and reduce unsafe behaviours.",
        ],
      },
      {
        title: "🧸 Daily supports",
        items: [
          "Chew toys or chewable jewellery available at all times",
          "Crunchy/chewy snacks throughout the day — bagels, toast, crackers, apples, crisps",
        ],
      },
      {
        title: "🥤 Oral activities",
        items: [
          "Blowing bubbles",
          "Straw games",
          "Thick drinks through a straw — smoothies, milkshakes",
          "Drinking through a sucky sports bottle",
          "💡 Why: provides deep input that helps regulate the nervous system.",
        ],
      },
      {
        title: "❄️ Temperature input",
        items: [
          "Cold drinks, slushies, frozen foods or yoghurts",
        ],
      },
      {
        title: "Progression",
        items: [
          "Build awareness — 'Do you need something to chew?'",
          "Support self-selection of tools.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // 4. EMOTIONAL REGULATION
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Emotional Regulation",
    description:
      "Children are not born knowing how to manage big feelings — they learn this over time through co-regulation with trusted adults. For many children, especially those with sensory differences, emotions can feel intense, overwhelming and difficult to understand. When a child is dysregulated their body is often in a 'fight, flight or freeze' state — they need support to feel safe before they can think clearly.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Big emotional reactions (anger, frustration, distress)",
          "Difficulty calming once upset",
          "Impulsive behaviours",
          "Sensitivity to changes or transitions",
          "Becoming overwhelmed in busy or demanding environments",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Help your child recognise and understand their feelings.",
          "Develop calming strategies.",
          "Feel supported and safe during big emotions.",
          "Gradually build independence in regulation.",
        ],
      },
      {
        title: "🧘 Calming & regulation strategies",
        items: [
          "Deep belly breathing — slow breaths in through the nose, out through the mouth. An expanda-ball can make this visual (open = breathe in, close = breathe out).",
          "Bubble breathing — blow bubbles slowly and gently, focusing on long breaths.",
          "Calm space — quiet, calming area (bedroom corner, sensory tent, cosy nook) with cushions, soft lighting, fidget toys, weighted lap pad or snake if appropriate.",
          "Deep pressure input — hugs, blanket 'burrito', weighted items (supervised).",
          "💡 Why: deep breathing + pressure activate the calming part of the nervous system and reduce stress.",
        ],
      },
      {
        title: "💬 Supporting emotional understanding",
        items: [
          "Name feelings: 'I can see you're feeling angry.' 'That looked frustrating.'",
          "Model emotions: 'I feel a bit overwhelmed, I'm going to take a break.'",
          "Validate before redirecting: 'I understand you're angry, but I can't let you hit. Let's find another way to help your body.'",
          "💡 Why: validation builds trust and reduces escalation.",
        ],
      },
      {
        title: "🔁 Daily regulation support",
        items: [
          "Sensory diet — regular movement, quiet time and deep pressure throughout the day.",
          "Fidget tools — squishy balls, putty, tangles.",
          "Liquid timer — slow visual movement is calming and grounding.",
          "💡 Why: a regulated body = better emotional control.",
        ],
      },
      {
        title: "⚠️ Understanding meltdowns",
        items: [
          "Meltdowns are not 'naughty behaviour' — they are a sign the child is overwhelmed and unable to cope.",
          "Common triggers: changes in routine, sensory overload, fatigue, anxiety or uncertainty.",
          "Supporting during a meltdown: stay calm and present, reduce language, offer space or comfort (depending on the child's needs), avoid reasoning or teaching in the moment.",
          "💡 Why: the thinking part of the brain is not accessible during high distress.",
        ],
      },
      {
        title: "🔎 Understanding triggers",
        items: [
          "Observe patterns: when does your child become overwhelmed? What environments are challenging? What helps them recover?",
          "Keep a simple diary.",
          "Talk through feelings after the event (once calm).",
        ],
      },
      {
        title: "📏 Boundaries & expectations",
        items: [
          "Set clear, consistent boundaries.",
          "Prepare your child for changes in routine.",
          "Use visual supports if helpful.",
          "💡 Why: predictability reduces anxiety and emotional overload.",
        ],
      },
      {
        title: "Progression",
        items: [
          "Start with adult support (co-regulation).",
          "Move to shared strategies (doing together).",
          "Gradually build independent use of strategies.",
        ],
      },
      {
        title: "💛 Key messages for parents",
        items: [
          "Your child is not giving you a hard time — they are having a hard time.",
          "Regulation comes before reasoning.",
          "Staying calm yourself is one of the most powerful tools.",
          "Small, consistent steps lead to big progress over time.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // 5. AUDITORY SENSITIVITY
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Auditory Sensitivity",
    description:
      "The auditory system helps us process and respond to sounds. Some children may be auditory sensitive (over-responsive) and easily overwhelmed by noise, auditory seeking (enjoying loud sounds), or have auditory processing difficulties. For children who are sensitive, everyday environments can feel too loud, unpredictable or overwhelming — affecting attention, behaviour and emotional regulation.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Covering ears or distress in noisy environments",
          "Becoming overwhelmed in busy places (shops, classrooms)",
          "Difficulty focusing with background noise",
          "Asking for repetition or not responding to instructions",
          "Sensitivity to specific sounds (hand dryers, vacuum)",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Reduce auditory overwhelm.",
          "Increase predictability.",
          "Support listening and attention.",
          "Gradually build tolerance to sound.",
        ],
      },
      {
        title: "🔇 Environmental supports",
        items: [
          "Reduce background noise — turn off TV/radio when not in use; cut competing sounds during homework or meals.",
          "Create a calm listening environment — quieter rooms for focused tasks; provide a calm corner or quiet retreat.",
          "💡 Why: too many sounds at once overloads the brain.",
        ],
      },
      {
        title: "🎧 Support tools",
        items: [
          "Ear defenders or headphones for loud / unpredictable environments (shopping centres, events).",
          "Calm sound input — soft music, white noise, nature sounds.",
          "💡 Why: predictable, gentle sounds help regulate the nervous system.",
        ],
      },
      {
        title: "🧩 Supporting listening & understanding",
        items: [
          "Simplify language — short, clear instructions; one step at a time.",
          "Pair with visual supports — visual schedules, gestures, pointing.",
          "💡 Why: reduces processing demand on the brain.",
        ],
      },
      {
        title: "🎵 Playful auditory activities",
        items: [
          "Sound detective — hide sound-making objects (bells, shakers); find them using listening.",
          "Copy the beat — clap or tap simple rhythms; child copies.",
          "Loud & quiet game — practise making loud vs quiet sounds (animal noises, instruments).",
          "Musical freeze — dance to music; freeze when it stops.",
          "💡 Why: builds auditory awareness and impulse control in low-pressure ways.",
        ],
      },
      {
        title: "🌍 Real-life sound exposure",
        items: [
          "Start with quieter, predictable sounds; slowly introduce louder or more complex environments; pair with preferred activities.",
          "Prepare for noisy environments — talk about what sounds to expect; use visuals or social stories; bring headphones.",
          "💡 Why: predictability reduces anxiety.",
        ],
      },
      {
        title: "🔁 Daily strategies",
        items: [
          "Build in quiet breaks — regular quiet time; calm spaces used proactively.",
          "Combine with sensory regulation — movement or deep pressure before challenging auditory environments.",
          "💡 Why: a regulated body copes better with sound.",
        ],
      },
      {
        title: "⚠️ When overwhelmed",
        items: [
          "Reduce noise immediately if possible.",
          "Move to a quieter space.",
          "Use calming strategies (deep pressure, breathing).",
          "Keep language minimal.",
          "💡 Why: the brain cannot process language effectively when overwhelmed.",
        ],
      },
      {
        title: "Progression",
        items: [
          "Start with managing the environment.",
          "Introduce structured listening activities.",
          "Gradually increase tolerance to real-world sounds.",
          "Support independence in asking for breaks or supports.",
        ],
      },
      {
        title: "💛 Key messages for parents",
        items: [
          "Sensitivity to sound is not a behaviour — it is a sensory response.",
          "Reducing overwhelm is more effective than 'pushing through'.",
          "Small, gradual exposure builds confidence over time.",
          "Your child may always be sensitive — but they can learn to manage it.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // 6. TACTILE DESENSITISATION
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Tactile Desensitisation",
    description:
      "The tactile (touch) system helps us understand and respond to sensations through our skin. Some children are tactile sensitive (avoidant) — they may dislike messy play, certain clothing or grooming. Others are tactile seeking or under-responsive — they may need stronger input and not notice light touch. This programme builds comfort with touch, increases sensory awareness, and supports regulation through tactile input.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Avoiding messy play or certain textures",
          "Wiping hands frequently or distress with touch",
          "Not noticing mess on hands or face",
          "Seeking strong touch (rubbing, crashing, pressing)",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Provide regular, playful tactile experiences in a way that feels safe, predictable and enjoyable.",
        ],
      },
      {
        title: "👐 Tactile play activities",
        items: [
          "Messy play exploration — hide small objects (coins, beads, sea creatures) in dry textures (rice, pasta, oats), mixed (kinetic sand), or wet (slime, gloop, shaving foam). Always have a towel or water nearby to build confidence.",
          "Heavy-duty touch tasks — washing toys with a sponge or brush; helping with laundry; cleaning surfaces with a cloth. Firm, deep touch is often more easily tolerated and calming.",
          "Playdough & putty — squashing, rolling, pulling, pressing objects in. Use themes (underwater worlds, dinosaur footprints) for engagement.",
          "Sticker station — peel and stick fuzzy / bumpy / smooth textures into themed scenes.",
          "Hide-and-seek sensory bags — fill a ziplock with gel and small objects; press and move to find them. Great for children sensitive to direct contact.",
          "Texture tunnel crawls — blankets, cushions, textured materials; crawl through during play.",
          "Therapy ball / peanut roll pressure — gently roll over the child's body while they lie on their tummy (avoid head). Deep pressure is calming.",
          "Tactile obstacle course — soft (pillows), rough (mats), squishy (foam); walk, crawl, jump, roll through.",
          "💡 Why: gradual, playful exposure helps the brain become more comfortable with different textures and improves processing.",
        ],
      },
      {
        title: "🧴 Supporting tactile tolerance",
        items: [
          "Gradual exposure — start with textures the child tolerates; slowly introduce new ones; follow the child's lead.",
          "Use tools — spoons, scoops, brushes, gloves initially. Creates a bridge between avoidance and full participation.",
          "Deep pressure before touch — massage, firm squeezes, heavy work. Prepares the nervous system and can make lighter touch more tolerable.",
        ],
      },
      {
        title: "🔁 Daily integration",
        items: [
          "Include tactile experiences during play (messy play, crafts), routines (washing, dressing), and functional tasks (helping at home).",
          "💡 Why: frequent, natural exposure is more effective than occasional activities.",
        ],
      },
      {
        title: "Progression",
        items: [
          "Start with observation and tolerance.",
          "Move to interaction with tools.",
          "Progress to hands-on exploration.",
          "Encourage longer engagement over time.",
        ],
      },
      {
        title: "💛 Key messages for parents",
        items: [
          "Never force participation.",
          "Keep activities playful and low pressure.",
          "Respect the child's boundaries.",
          "Celebrate small steps — even brief touch is progress.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // 7. SLEEP SUPPORT
  // ────────────────────────────────────────────────────────────────────
  {
    title: "Sleep Support",
    description:
      "Sleep can be particularly challenging for children with sensory differences — especially those who seek movement or have difficulty transitioning from a busy alert state to a calm restful one. For many children the body does not naturally 'switch off' — it needs support to move from alert → organised → calm. This programme calms the nervous system, creates predictability, and supports the body to feel safe and ready for sleep.",
    sections: [
      {
        title: "What you might notice",
        items: [
          "Difficulty settling at bedtime",
          "High energy levels in the evening",
          "Frequent movement or restlessness",
          "Waking during the night",
          "Needing lots of input (movement, touch) to fall asleep",
        ],
      },
      {
        title: "Programme aim",
        items: [
          "Help the body gradually slow down and feel calm, using deep pressure, movement, and consistent routines.",
        ],
      },
      {
        title: "🌇 Before bed (wind-down phase)",
        items: [
          "Heavy work & deep pressure — after dinner, pushing cushions, helping tidy up, crawling or animal walks to the bedroom, carrying books or soft items.",
          "Screen time — turn off screens at least 1 hour before bed.",
          "Outdoor time — aim for time outside in natural daylight during the day.",
          "💡 Why: heavy work grounds the body; natural light supports the body's internal clock; blue light from screens reduces melatonin.",
        ],
      },
      {
        title: "🧸 Calming sensory activities",
        items: [
          "Playdough or putty — squashing, squeezing, rolling, pulling. Calming proprioceptive input.",
          "Hammock or blanket swing — gently side to side. Rhythmic movement regulates the vestibular system.",
          "Blanket 'sausage roll' — roll the child in a blanket (avoid head), firm pressure. Deep pressure helps the body feel safe and ready for rest.",
          "Peanut ball or gym ball rolling — roll firmly over the body (ankles → shoulders, avoid head). Highly calming proprioceptive input.",
          "Massage — gentle but firm hand or foot massage with cream. Promotes relaxation and body awareness.",
        ],
      },
      {
        title: "🛁 Bedtime routine",
        items: [
          "Warm bath — relaxes muscles and signals to the body that sleep is approaching.",
          "Snack before bed — a small crunchy or chewy snack provides regulating oral input.",
          "Predictable routine — same steps each night (bath → pyjamas → story → bed). Use visuals if helpful.",
          "💡 Why: predictability reduces anxiety and helps the brain prepare for sleep.",
        ],
      },
      {
        title: "🛏️ Sleep environment",
        items: [
          "Room setup — calm, neutral colours; minimal clutter and toys.",
          "Lighting — dim in the evening; red-light night light if needed (red supports melatonin; blue increases alertness).",
          "Sound — quiet, predictable; white noise if helpful.",
        ],
      },
      {
        title: "Progression & expectations",
        items: [
          "Improvements may take time — consistency is key.",
          "Build a predictable, calming routine.",
          "Notice what works best for your child and repeat it.",
          "Gradually reduce support as the child becomes more settled.",
        ],
      },
      {
        title: "💛 Key messages for parents",
        items: [
          "Sleep is not just behavioural — it is sensory and biological.",
          "A child who 'won't settle' often can't settle yet.",
          "Your support helps their nervous system learn how to feel calm.",
        ],
      },
    ],
  },
];

async function main() {
  // Establish baseline orderIndex — append after whatever already exists.
  const last = await prisma.programmeTemplate.findFirst({
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  let nextIndex = (last?.orderIndex ?? -1) + 1;

  let created = 0;
  let updated = 0;

  for (const p of PROGRAMMES) {
    // Idempotent on title — re-running refreshes content without dupes.
    const existing = await prisma.programmeTemplate.findFirst({
      where: { title: p.title },
      select: { id: true, orderIndex: true },
    });

    const sectionsJson = p.sections.map((s) => ({
      title: s.title,
      items: s.items.map((text) => ({ text })),
    }));

    if (existing) {
      await prisma.programmeTemplate.update({
        where: { id: existing.id },
        data: { description: p.description, sections: sectionsJson },
      });
      updated++;
      console.log(`  ↻ Updated: ${p.title}`);
    } else {
      await prisma.programmeTemplate.create({
        data: {
          title: p.title,
          description: p.description,
          sections: sectionsJson,
          orderIndex: nextIndex++,
        },
      });
      created++;
      console.log(`  + Created: ${p.title}`);
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
