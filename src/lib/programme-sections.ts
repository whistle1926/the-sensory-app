// Shared type + sanitiser for ProgrammeTemplate.sections.
//
// sections is stored as JSON on the row. Historically items were just strings;
// now they're objects with optional demo metadata. We keep reading both shapes
// so existing rows don't need migrating.

export interface DemoStep {
  caption: string;
  imageUrl: string;
}

export interface ProgrammeItem {
  text: string;
  demoSteps?: DemoStep[];
  videoUrl?: string; // reserved for future real-video support
}

export interface ProgrammeSection {
  title: string;
  items: ProgrammeItem[];
}

function sanitiseDemoSteps(input: unknown): DemoStep[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: DemoStep[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { caption?: unknown; imageUrl?: unknown };
    const caption = typeof e.caption === "string" ? e.caption.trim() : "";
    const imageUrl = typeof e.imageUrl === "string" ? e.imageUrl.trim() : "";
    if (!caption || !imageUrl) continue;
    out.push({ caption, imageUrl });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Turn an unknown item payload into a canonical ProgrammeItem. Accepts:
 *   - a plain string (legacy shape) — becomes { text: s }
 *   - an object { text, demoSteps?, videoUrl? }
 * Returns null if the entry has no meaningful text after trimming.
 */
export function sanitiseProgrammeItem(input: unknown): ProgrammeItem | null {
  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return null;
    return { text };
  }
  if (!input || typeof input !== "object") return null;
  const raw = input as {
    text?: unknown;
    demoSteps?: unknown;
    videoUrl?: unknown;
  };
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) return null;
  const item: ProgrammeItem = { text };
  const demo = sanitiseDemoSteps(raw.demoSteps);
  if (demo) item.demoSteps = demo;
  if (typeof raw.videoUrl === "string") {
    const v = raw.videoUrl.trim();
    if (v) item.videoUrl = v;
  }
  return item;
}

/**
 * Sanitise an entire sections payload as it comes in from the client, or out
 * of the Json column. Drops sections that have no title AND no items.
 */
export function sanitiseProgrammeSections(input: unknown): ProgrammeSection[] {
  if (!Array.isArray(input)) return [];
  const out: ProgrammeSection[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { title?: unknown; items?: unknown };
    const title = typeof e.title === "string" ? e.title.trim() : "";
    const items: ProgrammeItem[] = Array.isArray(e.items)
      ? (e.items
          .map(sanitiseProgrammeItem)
          .filter(Boolean) as ProgrammeItem[])
      : [];
    if (!title && items.length === 0) continue;
    out.push({ title, items });
  }
  return out;
}
