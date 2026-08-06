import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import type { Block } from "@/lib/page-blocks";
import { RichTextView } from "@/components/ui/rich-text-view";

/**
 * Renders a page's blocks.
 *
 * Shared by the real public page and the editor's live preview, so what an
 * OT approves is exactly what a visitor gets. All the styling lives here —
 * the editor only ever collects words and links.
 */
export function PageBlocksView({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing on this page yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return b.level === 1 ? (
              <h1
                key={b.id}
                className="text-4xl font-black tracking-tight sm:text-5xl"
              >
                {b.text}
              </h1>
            ) : (
              <h2
                key={b.id}
                className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {b.text}
              </h2>
            );

          case "text":
            return (
              <RichTextView
                key={b.id}
                html={b.html}
                className="text-base leading-relaxed text-muted-foreground"
              />
            );

          case "image":
            if (!b.url) return null;
            return (
              <figure
                key={b.id}
                className={b.width === "inset" ? "mx-auto max-w-md" : ""}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.url}
                  alt={b.alt}
                  className="w-full rounded-2xl border border-border object-cover"
                />
                {b.caption && (
                  <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                    {b.caption}
                  </figcaption>
                )}
              </figure>
            );

          case "buttons":
            if (b.items.length === 0) return null;
            return (
              <div key={b.id} className="flex flex-wrap gap-3">
                {b.items.map((it, i) => (
                  <Link
                    key={i}
                    href={it.href}
                    className={
                      it.primary
                        ? "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                        : "inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-bold transition hover:bg-muted"
                    }
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            );

          case "cards":
            if (b.items.length === 0) return null;
            return (
              <div key={b.id} className="grid gap-4 sm:grid-cols-2">
                {b.items.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
                  >
                    {c.title && <p className="text-base font-bold">{c.title}</p>}
                    {c.body && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {c.body}
                      </p>
                    )}
                    {c.href && (
                      <Link
                        href={c.href}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        {c.cta || "Find out more"}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            );

          case "quote":
            if (!b.text) return null;
            return (
              <blockquote
                key={b.id}
                className="rounded-3xl border border-border/70 bg-card p-6 shadow-[var(--shadow-sm)] sm:p-8"
              >
                <Quote className="h-5 w-5 text-primary/40" />
                <p className="mt-3 whitespace-pre-line text-base leading-relaxed">
                  {b.text}
                </p>
                {b.author && (
                  <footer className="mt-3 text-sm font-semibold">
                    {b.author}
                  </footer>
                )}
              </blockquote>
            );

          case "spacer":
            return <div key={b.id} className="h-8" />;

          default:
            return null;
        }
      })}
    </div>
  );
}
