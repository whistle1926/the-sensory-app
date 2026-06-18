import Anthropic from "@anthropic-ai/sdk";
import { REPORT_SYSTEM_PROMPT, buildUserPrompt } from "./report-prompt";
import { ReportContent } from "@/types/report";
import { createMessageResilient } from "./ai-model";

/**
 * Tidy prompt — distinct from the generation prompt. This is for
 * the "Tidy with AI" pass the OT runs at the end of editing to
 * smooth grammar, tone, and UK-English consistency without altering
 * any clinical content. Tight guardrails are the whole point: the
 * OT will approve or discard, but Claude must NOT invent or remove
 * observations, change names/dates/numbers, or reword the meaning.
 */
const TIDY_SYSTEM_PROMPT = `You are a paediatric occupational-therapy editor. The user will send you a structured OT report as JSON. Your job is ONLY to clean up the prose so it reads well in a finished clinical document.

ABSOLUTE RULES — violating any of these makes the output unusable:
1. Return JSON matching the input shape EXACTLY. Same keys, same nesting. No keys added or removed.
2. NEVER change any of:
   - Names (clientInfo.clientName, parentCarer, therapistName)
   - Dates (dateOfBirth, sessionDate, reportDate, reviewDate)
   - Numbers (age strings, session number, qualifications)
   - Diagnosis text
   - Referrer text
   - sectionOrder array — copy verbatim if present
3. NEVER add observations or findings that weren't already in the source. NEVER remove ones that were.
4. NEVER change the meaning of any sentence. Preserve every clinical fact, every recommendation, every goal.
5. "Suggested follow-up:" prefixed text in Functional Review fields must stay as suggestions — do NOT convert into observed findings.
6. Field values that are exactly "Not assessed this session" must remain that exact phrase.
7. Empty strings must remain empty strings.

WHAT YOU MAY DO:
- Fix typos and grammar mistakes
- Standardise to UK English (behaviour, organisation, programme, colour, paediatric, recognise)
- Smooth awkward phrasing into clear sentences
- Apply consistent paragraph structure
- Use professional clinical tone (warm but precise)
- Standardise punctuation (single space after full stops, Oxford comma optional but consistent)
- Replace casual contractions in narrative prose with formal forms (don't → do not) where it reads more professional
- Tighten redundant phrasing

OUTPUT FORMAT:
Return ONLY the JSON object. No commentary, no markdown code fences, no preamble.`;

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
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
  return textBlock.text.trim();
}

export async function tidyReport(content: ReportContent): Promise<ReportContent> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // Model + fallback chain live in ai-model.ts. Structured text/JSON
  // generation (not reasoning) — disable thinking and run at low effort
  // to stay well under the 60s function limit.
  const { message } = await createMessageResilient(anthropic, {
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    max_tokens: 8192,
    system: TIDY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Tidy this report. Return the JSON with the same shape:\n\n${JSON.stringify(content)}`,
      },
    ],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  // Tolerate a leading/trailing code-fence even though we told it
  // not to use one — model occasionally drops a ```json wrapper.
  let text = textBlock.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return JSON.parse(text) as ReportContent;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  const userPrompt = buildUserPrompt(
    clientInfo,
    sessionDate,
    sessionNumber,
    rawNotes,
    therapistName
  );

  // Model + fallback chain live in ai-model.ts. Structured text/JSON
  // generation (not reasoning) — disable thinking and run at low effort
  // to stay well under the 60s function limit.
  const { message } = await createMessageResilient(anthropic, {
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    max_tokens: 4096,
    system: REPORT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const parsed = JSON.parse(textBlock.text) as ReportContent;
  return parsed;
}
