/**
 * First-pass triage of a build-board ticket.
 *
 * Grace and Claire log things in the evening; nobody should have to be at a
 * keyboard for a report to get read. This reads a ticket and produces a
 * plain-English first response and a category, so every ticket gets an
 * answer within hours rather than whenever the board is next opened.
 *
 * Deliberately limited to WORDS. It comments and categorises; it never
 * changes a booking, a price, a course or anything else. Code changes stay
 * with a person: several fixes this month looked obvious and turned out to
 * need judgement (a "broken" 9am slot that was working as designed, a day
 * grid mangled by browser translation). Getting those wrong in a comment
 * costs an apology; getting them wrong in production costs a client.
 */
import { getAnthropicClient } from "./ai-model";
import { createMessageResilient } from "./ai-model";

export type TriageCategory = "bug" | "question" | "request" | "needs-decision";

export interface TriageResult {
  category: TriageCategory;
  /** One line for the digest. */
  summary: string;
  /** What to post on the ticket, in Paddy's voice. */
  reply: string;
  /** True when a person has to choose something before work can start. */
  needsPaddy: boolean;
  /** False = say nothing. Not every message deserves a reply. */
  needsReply: boolean;
}

const SYSTEM = `You are drafting the first response on a small business's internal build board.

The business is The Sensory Submarine, a children's occupational therapy practice in Northern Ireland. Tickets are logged by Grace (the OT who owns the business) and Claire (admin). Paddy is the technical lead — you are drafting in his voice, and he replies as a person, not a helpdesk.

How Paddy writes: plain English, no jargon unless he explains it, warm but brief. He says what he has found, what he is going to do, and what he needs from them. He owns mistakes directly ("that one was my fault"). He never says "I have escalated this" or "thank you for your patience".

Rules:
- You have NOT investigated the code. Never claim something is fixed, deployed or tested. You are acknowledging and setting expectations.
- If the ticket is unclear, ask the one question that would unblock it — not a list.
- If it needs a business decision (a price, going live, changing what clients can book, deleting anything), say so plainly and set needsPaddy true.
- Never promise a timescale.
- British spelling.

You may be seeing a conversation already in progress. Read the whole thread and respond to the LATEST message, not the original ticket.

Stay quiet when there is nothing useful to add — set needsReply false if:
- the last message is Paddy giving instructions or answering something himself
- it is a thank-you or an acknowledgement needing no response
- you would only be repeating what has already been said

Answering a question they asked, or acknowledging new information, is worth a reply. Chatter is not.

Reply with JSON only: {"category":"bug|question|request|needs-decision","summary":"one line","reply":"the comment","needsPaddy":true|false,"needsReply":true|false}`;

export async function triageTicket(args: {
  title: string;
  description: string;
  loggedBy: string;
  /** The whole thread so far, oldest first, as "Name: what they said". */
  existingComments: string[];
}): Promise<TriageResult | null> {
  try {
    const anthropic = await getAnthropicClient();
    const { message } = await createMessageResilient(anthropic, {
      max_tokens: 900,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Ticket logged by ${args.loggedBy}.

Title: ${args.title}

What they wrote:
${args.description || "(no detail given)"}

${
  args.existingComments.length
    ? `The conversation so far, oldest first — respond to the last message:\n${args.existingComments
        .map((c) => `- ${c}`)
        .join("\n")}`
    : "No comments yet — this is the first response."
}`,
        },
      ],
    });

    const text = message.content
      .map((b) => ("text" in b ? b.text : ""))
      .join("")
      .trim();
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as TriageResult;
    if (!parsed?.reply || !parsed?.summary) return null;
    return {
      category: parsed.category ?? "question",
      summary: String(parsed.summary).slice(0, 300),
      reply: String(parsed.reply).slice(0, 4000),
      needsPaddy: !!parsed.needsPaddy,
      // Absent means yes — an older response shape shouldn't silence it.
      needsReply: parsed.needsReply !== false,
    };
  } catch (err) {
    console.error("[triage-agent] failed:", err);
    return null;
  }
}
