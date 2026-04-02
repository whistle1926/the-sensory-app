import Anthropic from "@anthropic-ai/sdk";
import { REPORT_SYSTEM_PROMPT, buildUserPrompt } from "./report-prompt";
import { ReportContent } from "@/types/report";

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

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
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
