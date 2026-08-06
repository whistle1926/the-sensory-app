/**
 * The building blocks of an editable page.
 *
 * Content is a list of typed blocks rather than free HTML. That's the whole
 * point: an OT writes the words, and the site decides how they look, so a
 * page can't end up with mismatched fonts or a wall of pasted Word styling.
 * It also means the design can be changed later in one place.
 */

export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "buttons"
  | "cards"
  | "quote"
  | "spacer";

export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
  /** 1 = big page title, 2 = section heading. */
  level: 1 | 2;
}

export interface TextBlock {
  id: string;
  type: "text";
  /** Sanitised rich text from the shared editor. */
  html: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  url: string;
  alt: string;
  caption?: string;
  /** "wide" spans the column; "inset" is narrower and centred. */
  width?: "wide" | "inset";
}

export interface ButtonsBlock {
  id: string;
  type: "buttons";
  items: Array<{ label: string; href: string; primary?: boolean }>;
}

export interface CardsBlock {
  id: string;
  type: "cards";
  items: Array<{ title: string; body: string; href?: string; cta?: string }>;
}

export interface QuoteBlock {
  id: string;
  type: "quote";
  text: string;
  author?: string;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
}

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonsBlock
  | CardsBlock
  | QuoteBlock
  | SpacerBlock;

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Words",
  image: "Picture",
  buttons: "Buttons",
  cards: "Cards",
  quote: "Quote",
  spacer: "Space",
};

/** Simple ids — enough to key a list and reorder it. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, text: "", level: 2 };
    case "text":
      return { id, type, html: "" };
    case "image":
      return { id, type, url: "", alt: "", width: "wide" };
    case "buttons":
      return { id, type, items: [{ label: "", href: "" }] };
    case "cards":
      return { id, type, items: [{ title: "", body: "" }] };
    case "quote":
      return { id, type, text: "" };
    case "spacer":
      return { id, type };
  }
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Only links we're happy to render: in-app paths or http(s). */
export function safeHref(raw: unknown): string {
  const t = str(raw, 500).trim();
  if (!t) return "";
  if (t.startsWith("/") || t.startsWith("#")) return t;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Coerce whatever is stored into blocks we know how to render. Anything
 * unrecognised is dropped rather than rendered blindly.
 */
export function cleanBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const item of raw.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const id = str(b.id, 40) || newId();
    switch (b.type) {
      case "heading":
        out.push({
          id,
          type: "heading",
          text: str(b.text, 300),
          level: b.level === 1 ? 1 : 2,
        });
        break;
      case "text":
        out.push({ id, type: "text", html: str(b.html, 20_000) });
        break;
      case "image":
        out.push({
          id,
          type: "image",
          url: safeHref(b.url),
          alt: str(b.alt, 300),
          caption: str(b.caption, 300) || undefined,
          width: b.width === "inset" ? "inset" : "wide",
        });
        break;
      case "buttons":
        out.push({
          id,
          type: "buttons",
          items: (Array.isArray(b.items) ? b.items : [])
            .slice(0, 4)
            .map((i) => {
              const o = (i ?? {}) as Record<string, unknown>;
              return {
                label: str(o.label, 80),
                href: safeHref(o.href),
                primary: o.primary === true,
              };
            })
            .filter((i) => i.label && i.href),
        });
        break;
      case "cards":
        out.push({
          id,
          type: "cards",
          items: (Array.isArray(b.items) ? b.items : [])
            .slice(0, 8)
            .map((i) => {
              const o = (i ?? {}) as Record<string, unknown>;
              return {
                title: str(o.title, 160),
                body: str(o.body, 600),
                href: safeHref(o.href) || undefined,
                cta: str(o.cta, 60) || undefined,
              };
            })
            .filter((i) => i.title || i.body),
        });
        break;
      case "quote":
        out.push({
          id,
          type: "quote",
          text: str(b.text, 2_000),
          author: str(b.author, 120) || undefined,
        });
        break;
      case "spacer":
        out.push({ id, type: "spacer" });
        break;
      default:
        break; // unknown type — drop it
    }
  }
  return out;
}

/** A URL-safe slug from a page title. */
export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
