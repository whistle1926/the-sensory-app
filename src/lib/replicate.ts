import Replicate from "replicate";

/**
 * Lazy singleton — keeps bundle slim and fails cleanly if REPLICATE_API_TOKEN
 * is missing at call time instead of at module-load.
 */
let _client: Replicate | null = null;
function client(): Replicate {
  if (_client) return _client;
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  _client = new Replicate({ auth: token });
  return _client;
}

/**
 * Run Flux Schnell — fast, cheap (~$0.003/image), good for cartoon illustrations.
 * Returns the temporary CDN URL of the generated image. Caller should re-host
 * to durable storage before persisting.
 */
export async function runFluxSchnell(
  prompt: string,
  /** Defaults to square, which is what the programme demo steps use. Course
   *  covers need a wide banner or a 4:3 card instead. */
  aspectRatio: "1:1" | "16:9" | "4:3" = "1:1",
): Promise<string> {
  const output = (await client().run("black-forest-labs/flux-schnell", {
    input: {
      prompt,
      num_outputs: 1,
      // WebP keeps the image small and modern browsers all support it.
      output_format: "webp",
      output_quality: 85,
      aspect_ratio: aspectRatio,
      // Schnell defaults to 4 inference steps — fine for a flat illustration.
    },
  })) as unknown;

  const url = extractFirstUrl(output);
  if (!url) {
    throw new Error("Replicate returned no output URL");
  }
  return url;
}

/**
 * Replicate's client can return ReadableStream-like File objects or bare URL
 * strings depending on the model. Walk the result and pull the first usable
 * URL. If we hit a File object, its `.url` is what we need.
 */
function extractFirstUrl(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const u = extractFirstUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof output === "object") {
    // Replicate file-output objects expose `.url()` (function) or `.url` (prop).
    const maybe = output as { url?: unknown };
    if (typeof maybe.url === "function") {
      try {
        const u = (maybe.url as () => unknown)();
        if (typeof u === "string") return u;
        if (u && typeof (u as URL).toString === "function") {
          return (u as URL).toString();
        }
      } catch {
        /* fall through */
      }
    }
    if (typeof maybe.url === "string") return maybe.url;
  }
  return null;
}
