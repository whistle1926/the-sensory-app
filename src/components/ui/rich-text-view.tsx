"use client";

import { useMemo } from "react";
import sanitizeHtml from "sanitize-html";
import { cn } from "@/lib/utils";

/**
 * Render stored rich text safely. Client-side sanitisation is a belt on
 * top of the server-side braces — we still expect the API to persist
 * only clean content, but never trust what lands in the DOM.
 */
const ALLOWED_TAGS = [
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
  "img",
  "iframe",
];

function toHtml(value: string): string {
  if (!value) return "";
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  const raw = looksLikeHtml
    ? value
    : `<p>${value.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`;
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "style", "width", "height", "class"],
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
    },
    allowedIframeHostnames: [
      "www.youtube.com",
      "www.youtube-nocookie.com",
      "youtube.com",
    ],
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
          // Force anchor colour through the prose styles.
          class: "text-primary underline",
        },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          class: "w-full aspect-video rounded-lg my-2",
          frameborder: "0",
          allowfullscreen: "true",
        },
      }),
    },
  });
}

export function RichTextView({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const safe = useMemo(() => toHtml(html), [html]);
  if (!safe) return null;
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:font-semibold prose-p:my-1.5",
        "prose-a:text-primary prose-a:underline",
        className
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
