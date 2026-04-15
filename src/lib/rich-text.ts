import sanitizeHtml from "sanitize-html";

/**
 * Allowed HTML produced by the Tiptap editor. Keep this tight — anything
 * the editor can't output should be stripped when sanitising user input.
 */
const BASE_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "iframe", // for the Youtube embed
];

const BASE_ALLOWED_ATTR: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  iframe: [
    "src",
    "width",
    "height",
    "frameborder",
    "allow",
    "allowfullscreen",
    "class",
    "style",
  ],
};

/**
 * Sanitise a rich-text string before persisting it. Accepts YouTube
 * iframes (nocookie and regular) and strips everything else that could
 * be dangerous.
 */
export function sanitizeRichText(input: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  return sanitizeHtml(trimmed, {
    allowedTags: BASE_ALLOWED_TAGS,
    allowedAttributes: BASE_ALLOWED_ATTR,
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "youtube.com"],
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

/**
 * Produce a plain-text summary of a rich-text blob (for previews in the
 * tasks list etc).
 */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
