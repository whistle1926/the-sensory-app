import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

/**
 * Resolve the Claude API key. Prefer the admin-managed key in
 * Settings → AI (AiSettings.apiKey) so it can be rotated in the app
 * without a redeploy — the same pattern as the Mailcub and FireBuddy
 * keys. Falls back to the ANTHROPIC_API_KEY env var if the DB has none.
 *
 * (The env var alone was a trap: Settings → AI showed a key field that
 * looked like the control but wasn't wired to anything, so a rotated env
 * key silently broke every AI feature — 2026-07-17.)
 */
export async function getAnthropicApiKey(): Promise<string | undefined> {
  try {
    const s = await prisma.aiSettings.findUnique({
      where: { id: "default" },
      select: { apiKey: true },
    });
    const dbKey = s?.apiKey?.trim();
    if (dbKey) return dbKey;
  } catch {
    // DB unreachable — fall through to the env var.
  }
  return process.env.ANTHROPIC_API_KEY || undefined;
}

/** An Anthropic client configured with the resolved key. */
export async function getAnthropicClient(): Promise<Anthropic> {
  return new Anthropic({ apiKey: await getAnthropicApiKey() });
}

/**
 * Single source of truth for the Claude model used by EVERY AI feature
 * (report generate/tidy/summary, programme demo images, leaflet
 * generation). Update the list here and every feature follows.
 *
 * It's an ORDERED FALLBACK CHAIN: the primary is tried first; if
 * Anthropic ever retires it (HTTP 404 not_found — the outage that broke
 * report writing on 2026-06-18), calls automatically retry on the next
 * model in the list, so AI features never go fully down. The models span
 * generations on purpose, so it's vanishingly unlikely all are retired
 * at once. A daily health check (in the booking-reminders cron) emails
 * an alert if the primary ever has to fall back, so the list gets
 * updated. Use bare alias IDs — never dated snapshots like
 * `claude-sonnet-4-20250514`, which retire on a schedule.
 */
export const AI_MODELS = [
  "claude-sonnet-4-6", // primary — fast, great for reports
  "claude-opus-4-8", // fallback 1 — most capable, different generation
  "claude-haiku-4-5", // fallback 2 — fastest / cheapest, last resort
] as const;

export const PRIMARY_AI_MODEL = AI_MODELS[0];

type CreateParams = Omit<
  Anthropic.Messages.MessageCreateParamsNonStreaming,
  "model"
>;

interface ResilientResult {
  message: Anthropic.Messages.Message;
  modelUsed: string;
  /** True when the primary was unavailable and a fallback was used. */
  fellBack: boolean;
}

/**
 * Create a message, auto-falling-back through AI_MODELS when a model is
 * retired/unavailable (404). Any other error (auth, rate limit, overload)
 * is re-thrown unchanged so we never mask a real problem as a fallback.
 * `params.model` is ignored — the chain decides the model.
 */
export async function createMessageResilient(
  anthropic: Anthropic,
  params: CreateParams,
): Promise<ResilientResult> {
  let lastErr: unknown;
  for (let i = 0; i < AI_MODELS.length; i++) {
    const model = AI_MODELS[i];
    try {
      const message = await anthropic.messages.create({ ...params, model });
      if (i > 0) {
        console.warn(
          `[ai-model] primary "${AI_MODELS[0]}" unavailable — used fallback "${model}". Update src/lib/ai-model.ts.`,
        );
      }
      return { message, modelUsed: model, fellBack: i > 0 };
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      // 404 = model not found / retired → try the next model. Anything
      // else is a genuine error we must surface.
      if (status === 404) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("All configured AI models are unavailable");
}

export interface AiHealth {
  ok: boolean;
  primary: string;
  modelUsed: string | null;
  /** Primary retired but a fallback worked — still needs attention. */
  fellBack: boolean;
  error?: string;
}

/**
 * Cheap liveness probe — a 1-token "ping". Returns ok:false on any
 * failure (missing key, retired models, billing) and fellBack:true when
 * the primary is gone but a fallback is serving. Used by the daily cron
 * to email an early-warning alert.
 */
export async function checkAiHealth(): Promise<AiHealth> {
  const primary = PRIMARY_AI_MODEL;
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      primary,
      modelUsed: null,
      fellBack: false,
      error:
        "No Claude API key configured (Settings → AI, or ANTHROPIC_API_KEY).",
    };
  }
  const anthropic = new Anthropic({ apiKey });
  try {
    const { modelUsed, fellBack } = await createMessageResilient(anthropic, {
      max_tokens: 4,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true, primary, modelUsed, fellBack };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      primary,
      modelUsed: null,
      fellBack: false,
      error: msg.slice(0, 400),
    };
  }
}
