import { REPORT_SYSTEM_PROMPT, buildUserPrompt } from "./report-prompt";
import { ReportContent } from "@/types/report";
import {
  createMessageResilient,
  getAnthropicClient,
  recordAiLatency,
} from "./ai-model";

/**
 * Tidy prompt — distinct from the generation prompt. This is for
 * the "Tidy with AI" pass the OT runs at the end of editing to
 * smooth grammar, tone, and UK-English consistency without altering
 * any clinical content. Tight guardrails are the whole point: the
 * OT will approve or discard, but Claude must NOT invent or remove
 * observations, change names/dates/numbers, or reword the meaning.
 */
// Per-FIELD tidy prompt. The report tidy used to send the whole report JSON
// in one call and ask for the whole thing back — ~6k output tokens, which
// took ~2 minutes and read as "broken". We now tidy each prose field in its
// own small, fast, PARALLEL call (plain text in/out — no giant JSON to
// truncate or fail to parse), then reassemble. This prompt governs one field.
const TIDY_FIELD_SYSTEM_PROMPT = `You are a paediatric occupational-therapy editor. You will be given the plain text of ONE section of a clinical OT report. Clean up ONLY the writing so it reads well in a finished clinical document.

ABSOLUTE RULES — violating any makes the output unusable:
1. NEVER change the meaning. Preserve every clinical fact, observation, finding, recommendation, goal, number, frequency and duration exactly.
2. NEVER add anything that wasn't there, and NEVER remove anything that was.
3. NEVER change names or dates.
4. If the text is exactly "Not assessed this session", return it exactly unchanged.
5. "Suggested follow-up:" prefixed text must stay as a suggestion — do NOT turn it into an observed finding.
6. If the input is empty or whitespace, return it unchanged.

WHAT YOU MAY DO:
- Fix typos, spelling, grammar and punctuation
- Standardise to UK English (behaviour, organisation, programme, colour, paediatric, recognise)
- Smooth awkward phrasing into clear sentences and tidy paragraph structure
- Professional clinical tone (warm but precise); expand casual contractions (don't → do not) where it reads more professionally
- Tighten redundant phrasing

OUTPUT FORMAT:
Return ONLY the cleaned text of this one section. No labels, no quotes, no JSON, no markdown, no commentary, no preamble.`;

/**
 * Summary prompts — one per audience. Used by the "Create Summary"
 * dialog on the report page. The summary is shown editable in the
 * compose modal before sending, so a slightly imperfect draft is
 * fine — the OT can tweak before clicking Send.
 */
const SUMMARY_PROMPTS: Record<"clinical" | "parent", string> = {
  clinical: `You are a paediatric OT writing a brief professional summary of a session report. The audience is the referring GP / school SENCO / fellow clinician — someone who needs the key findings + next steps without reading the full report.

Constraints:
- Plain text. No markdown headings, no asterisks, no bullets — just flowing paragraphs.
- ~180 words, max 250.
- UK English.
- Professional clinical tone. Use clinical terms but add a brief parenthetical plain-English gloss when the term is uncommon.
- Cover, in this order: (1) child's first name + age + reason for referral, (2) the most relevant findings, (3) the top 2-3 recommendations / next steps.
- Do NOT invent facts. Only summarise what's in the report.
- Sign off with the therapist's name from the report.

Return ONLY the summary text — no preamble, no commentary.`,

  parent: `You are a paediatric OT writing a warm summary of a session report for the child's parent or carer. The audience already knows their child — they need a digestible recap they can read on their phone.

Constraints:
- Plain text. No markdown headings, no asterisks, no bullets — just flowing paragraphs.
- ~180 words, max 250.
- UK English.
- Warm, plain English. Avoid jargon. When a clinical term is genuinely needed, briefly explain in everyday words.
- Use "your child" or the child's first name. Use "you" and "your".
- Cover, in this order: (1) what we worked on in the session, (2) what we found / saw, (3) what to try at home and what comes next.
- Do NOT invent facts. Only summarise what's in the report.
- End with a short warm note inviting them to ask questions.

Return ONLY the summary text — no preamble, no commentary.`,
};

export async function summariseReport(
  content: ReportContent,
  audience: "clinical" | "parent",
): Promise<string> {
  const t0 = Date.now();
  let ok = false;
  try {
    const anthropic = await getAnthropicClient();
    // Model + fallback chain live in ai-model.ts. Structured text/JSON
    // generation (not reasoning) — disable thinking and run at low effort
    // to stay well under the 60s function limit.
    const { message } = await createMessageResilient(anthropic, {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      max_tokens: 1024,
      system: SUMMARY_PROMPTS[audience],
      messages: [
        {
          role: "user",
          content: `Summarise this report. Return plain text only:\n\n${JSON.stringify(content)}`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }
    ok = true;
    return textBlock.text.trim();
  } finally {
    void recordAiLatency("report.summary", Date.now() - t0, ok);
  }
}

// The dot-paths of every free-text PROSE field in a report — the only
// things "Tidy with AI" should touch. Names, dates, numbers, diagnosis,
// referrer, qualifications and sectionOrder are deliberately excluded so
// they can never be altered. functionalReview.* is optional (older reports).
const TIDY_FIELD_PATHS = [
  "reasonForReferral",
  "sessionOverview",
  "observations.sensoryResponses",
  "observations.engagementParticipation",
  "observations.communicationSocial",
  "observations.emotionalRegulation",
  "assessmentFindings.sensoryProcessing",
  "assessmentFindings.fineMotor",
  "assessmentFindings.grossMotor",
  "assessmentFindings.selfRegulation",
  "assessmentFindings.playFunctional",
  "functionalReview.feedingAndEating",
  "functionalReview.personalCareAndDressing",
  "functionalReview.toileting",
  "functionalReview.sleep",
  "functionalReview.school",
  "functionalReview.otherConcerns",
  "functionalReview.discussionWithParent",
  "interventionsUsed",
  "responseToIntervention",
  "clinicalImpressions",
  "recommendations",
  "goals.shortTerm",
  "goals.longTerm",
  "goals.nextSessionPlan",
  "homeProgrammeSuggestions",
] as const;

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj,
  );
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let node: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!node[k] || typeof node[k] !== "object") node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

/** Run async `fn` over `items` with a bounded concurrency (a small pool). */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/**
 * Tidy a single report field. Small, fast call — plain text in, plain text
 * out (no JSON to truncate or fail to parse). Best-effort: on ANY failure it
 * returns the original text unchanged, so one flaky field never breaks the
 * whole tidy or loses the OT's writing.
 */
async function tidyField(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "Not assessed this session") return text;
  try {
    const anthropic = await getAnthropicClient();
    const { message } = await createMessageResilient(anthropic, {
      max_tokens: 4096,
      system: TIDY_FIELD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });
    const block = message.content.find((b) => b.type === "text");
    const out = block && block.type === "text" ? block.text.trim() : "";
    return out || text;
  } catch (err) {
    console.error("[tidyField] failed — keeping original", err);
    return text;
  }
}

/**
 * "Tidy with AI" for a report. Tidies every prose field CONCURRENTLY (small
 * fast calls) and reassembles — replacing the old single ~6k-token call that
 * regenerated the whole report and took ~2 minutes. Names/dates/numbers/
 * structure are never sent for editing, so they can't change.
 */
export async function tidyReport(content: ReportContent): Promise<ReportContent> {
  const t0 = Date.now();
  let ok = false;
  try {
    // Deep clone so untouched fields (names, dates, sectionOrder, etc.) pass
    // through byte-for-byte.
    const result = JSON.parse(JSON.stringify(content)) as Record<string, unknown>;

    // Only tidy fields that actually hold non-empty text.
    const targets = TIDY_FIELD_PATHS.filter((p) => {
      const v = getPath(content, p);
      return typeof v === "string" && v.trim().length > 0;
    });

    const tidied = await mapPool(targets, 8, async (path) => ({
      path,
      text: await tidyField(getPath(content, path) as string),
    }));

    for (const { path, text } of tidied) setPath(result, path, text);
    ok = true;
    return result as unknown as ReportContent;
  } finally {
    // Flag it if tidy ever runs slow again (self-clears when quick). Never
    // affects the call.
    void recordAiLatency("report.tidy", Date.now() - t0, ok);
  }
}

/**
 * Tidy-pass for a home programme body. Unlike the report tidy this works
 * on a single HTML string (the rich-text body) rather than structured
 * JSON, and the audience is a parent/carer rather than a clinician — so
 * the tone target is warm and plain, not clinical.
 */
const TIDY_HOME_PROGRAMME_PROMPT = `You are a paediatric occupational-therapy editor. The user will send you the HTML body of a home programme written for a parent/carer to follow at home. Your job is ONLY to clean up the writing so it reads well — often the therapist has "dumped" rough notes and wants them tidied.

ABSOLUTE RULES — violating any of these makes the output unusable:
1. Return ONLY the cleaned HTML body. No code fence, no commentary, no <html>/<body> wrapper.
2. Preserve the HTML structure and every tag exactly: headings, <strong>, <em>, <u>, <ul>/<ol>/<li>, <p>, <br>, <a href="..."> and <img src="..."> must all survive. NEVER alter, shorten or drop a URL in href or src — the links and demo photos must keep working.
3. NEVER add activities, strategies or advice that weren't already there. NEVER remove any.
4. NEVER change the meaning. Preserve every instruction and every number exactly — repetitions, frequencies, durations and sets (e.g. "3x a day", "10 minutes", "twice weekly").
5. NEVER change names (the child's, the parent's, the therapist's).
6. If the body is empty, return it unchanged.

WHAT YOU MAY DO:
- Fix typos, spelling and grammar
- Standardise to UK English (behaviour, programme, colour, paediatric, recognise, practise)
- Turn rough/dumped notes into clear, complete sentences
- Improve paragraphing and tidy list structure
- Use a warm, encouraging, plain-English tone a busy parent can follow — avoid clinical jargon where a simpler word works`;

export async function tidyHomeProgramme(html: string): Promise<string> {
  const t0 = Date.now();
  let ok = false;
  try {
    const anthropic = await getAnthropicClient();
    // Model + fallback chain live in ai-model.ts. Structured text generation
    // (not reasoning) — disable thinking and run at low effort to stay well
    // under the function time limit.
    const { message } = await createMessageResilient(anthropic, {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      max_tokens: 8192,
      system: TIDY_HOME_PROGRAMME_PROMPT,
      messages: [
        {
          role: "user",
          content: `Tidy this home programme. Return the HTML body only:\n\n${html}`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }
    // Tolerate a code-fence even though we told it not to use one.
    let text = textBlock.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "");
    }
    ok = true;
    return text.trim();
  } finally {
    void recordAiLatency("home-programme.tidy", Date.now() - t0, ok);
  }
}

// Progress notes are the OT's own clinical record of a session — often typed
// quickly or dictated, so they want cleaning up without changing what was
// recorded. Clinical tone (not the warm parent tone of a home programme), and
// the same absolute preserve-the-facts guardrails.
const TIDY_PROGRESS_NOTE_PROMPT = `You are a paediatric occupational-therapy editor. The user will send you the HTML body of a clinical PROGRESS NOTE — the therapist's own record of a session, often typed fast or dictated. Clean up ONLY the writing.

ABSOLUTE RULES — violating any of these makes the output unusable:
1. Return ONLY the cleaned HTML body. No code fence, no commentary, no <html>/<body> wrapper.
2. Preserve the HTML structure and every tag exactly: headings, <strong>, <em>, <u>, <ul>/<ol>/<li>, <p>, <br>, and any <a href="..."> must all survive. NEVER alter or drop a URL.
3. NEVER change the meaning. Preserve every clinical fact, observation, activity, response, measurement and plan exactly — including numbers, frequencies, durations and repetitions.
4. NEVER add observations, findings or recommendations that weren't there, and NEVER remove any.
5. NEVER change names (the child's, parent's, therapist's) or dates.
6. If the body is empty, return it unchanged.

WHAT YOU MAY DO:
- Fix typos, spelling, grammar and punctuation
- Standardise to UK English (behaviour, organisation, programme, colour, paediatric, recognise)
- Turn rough/dictated notes into clear, complete sentences
- Improve paragraphing and tidy list structure
- Use a professional clinical tone (warm but precise); expand casual contractions (don't → do not) where it reads more professionally

OUTPUT FORMAT:
Return ONLY the cleaned HTML body — no code fence, no commentary, no preamble.`;

/**
 * Tidy a clinical progress note (single HTML body). Mirrors tidyHomeProgramme
 * but with a clinical rather than parent-facing tone.
 */
export async function tidyProgressNote(html: string): Promise<string> {
  const t0 = Date.now();
  let ok = false;
  try {
    const anthropic = await getAnthropicClient();
    const { message } = await createMessageResilient(anthropic, {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      max_tokens: 8192,
      system: TIDY_PROGRESS_NOTE_PROMPT,
      messages: [
        {
          role: "user",
          content: `Tidy this progress note. Return the HTML body only:\n\n${html}`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }
    let text = textBlock.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "");
    }
    ok = true;
    return text.trim();
  } finally {
    void recordAiLatency("progress-note.tidy", Date.now() - t0, ok);
  }
}


export async function generateReport(
  clientInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    diagnosis?: string | null;
    presentingConcerns?: string | null;
    referrer?: string | null;
    parentCarerName?: string | null;
  },
  sessionDate: string,
  sessionNumber: number,
  rawNotes: string,
  therapistName: string
): Promise<ReportContent> {
  const t0 = Date.now();
  let ok = false;
  try {
    const userPrompt = buildUserPrompt(
      clientInfo,
      sessionDate,
      sessionNumber,
      rawNotes,
      therapistName
    );

    const anthropic = await getAnthropicClient();

    // Model + fallback chain live in ai-model.ts. Structured text/JSON
    // generation (not reasoning) — disable thinking and run at low effort
    // to stay well under the 60s function limit.
    //
    // max_tokens must comfortably fit a FULL report: ~25 fields including
    // the 7-field Functional Review and the home-programme block. At 4096
    // a detailed session truncated the JSON mid-object, which then failed
    // to parse ("Claude returned a response we couldn't parse"). 8192
    // gives generous headroom; effort=low keeps it well under the limit.
    const { message } = await createMessageResilient(anthropic, {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      max_tokens: 8192,
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // If the model hit the token ceiling the JSON is incomplete — say so
    // clearly rather than surfacing a cryptic parse error.
    if (message.stop_reason === "max_tokens") {
      throw new Error(
        "The report was too long to finish in one go. Please shorten the session notes slightly and try again.",
      );
    }

    const parsed = parseReportJson(textBlock.text);
    ok = true;
    return parsed;
  } finally {
    void recordAiLatency("report.generate", Date.now() - t0, ok);
  }
}

/**
 * Parse the model's JSON report defensively. We instruct it to return
 * raw JSON, but models occasionally wrap it in a ```json code fence or
 * add a stray line of preamble. Rather than fail the whole generation
 * on that, strip a fence if present and, as a last resort, slice from
 * the first "{" to the last "}" before parsing.
 */
function parseReportJson(raw: string): ReportContent {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    return JSON.parse(text) as ReportContent;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) {
      return JSON.parse(text.slice(first, last + 1)) as ReportContent;
    }
    throw new Error("Claude returned a response we couldn't parse");
  }
}

// ── Course storefront copy ────────────────────────────────────────────
// Grace writes a few plain lines about a webinar; this turns them into the
// fields the course page needs. It deliberately does NOT invent clinical
// claims — the prompt tells it to work only from what she wrote, because the
// output is sales copy for a paid product and an invented promise is worse
// than a thin one. Everything comes back editable for her to approve.

const COURSE_COPY_PROMPT = `You write short, warm marketing copy for a paediatric occupational therapy practice in Northern Ireland (The Sensory Submarine). The audience is parents and carers of young children — often tired, often worried, not clinicians.

You will be given: a course title, and a few rough lines the therapist wrote about it.

Write the storefront copy for it. Rules:
- Work ONLY from what the therapist wrote plus the title. Do NOT invent facts, outcomes, durations, credentials, statistics or promises she did not make. If her notes are thin, keep the copy thin.
- Never claim a therapeutic outcome ("this will fix…", "guaranteed to…"). Say what the session covers, not what it cures.
- Plain, warm, everyday English. UK spelling. No jargon, no hype, no exclamation marks.
- Speak to "you" and "your child".

Return ONLY a JSON object, no markdown fence, with exactly these keys:
{
  "tagline": "one short line, max 12 words, sits under the title",
  "shortDescription": "1-2 sentences for the course card, max 200 characters",
  "description": "2-3 short paragraphs for the course page, plain text with \\n\\n between paragraphs",
  "audience": "who it is for, max 12 words, e.g. 'Parents of children aged 3-6'",
  "audienceFor": "2-3 sentences expanding on who would benefit",
  "features": ["4 to 6 short bullet points of what is covered — each max 12 words"]
}`;

export interface CourseCopyDraft {
  tagline: string;
  shortDescription: string;
  description: string;
  audience: string;
  audienceFor: string;
  features: string[];
}

export async function draftCourseCopy(args: {
  title: string;
  notes: string;
}): Promise<CourseCopyDraft> {
  const t0 = Date.now();
  let ok = false;
  try {
    const anthropic = await getAnthropicClient();
    const { message } = await createMessageResilient(anthropic, {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      max_tokens: 2048,
      system: COURSE_COPY_PROMPT,
      messages: [
        {
          role: "user",
          content: `Course title: ${args.title}\n\nWhat the therapist wrote about it:\n${args.notes}`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }
    let text = textBlock.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    }
    const raw = JSON.parse(text) as Partial<CourseCopyDraft>;
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";
    const draft: CourseCopyDraft = {
      tagline: str(raw.tagline, 240),
      shortDescription: str(raw.shortDescription, 500),
      description: str(raw.description, 5_000),
      audience: str(raw.audience, 120),
      audienceFor: str(raw.audienceFor, 2_000),
      features: Array.isArray(raw.features)
        ? raw.features
            .filter((f): f is string => typeof f === "string")
            .map((f) => f.trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 8)
        : [],
    };
    ok = true;
    return draft;
  } finally {
    void recordAiLatency("course.copy", Date.now() - t0, ok);
  }
}
