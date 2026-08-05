"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";

/**
 * The parent-facing course page, embedded right in the editor.
 *
 * It's an iframe of the REAL page rather than a rebuilt approximation — the
 * whole point is to see exactly what a parent gets, so a separate rendering
 * would defeat it. Staff can load an unpublished course, so this works before
 * anything goes on sale.
 *
 * Refresh is manual and explicit: the editor saves on a button, so an
 * auto-refreshing frame would show stale or half-saved copy and cause more
 * confusion than it solved. Press Save, then Refresh.
 */
export function CoursePreview({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<"phone" | "desktop">("desktop");
  // Bumping this remounts the iframe, which is the only reliable way to force
  // a cross-document reload we don't own.
  const [nonce, setNonce] = useState(0);

  const src = `/courses/${slug}?_p=${nonce}`;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span>
          <span className="block text-sm font-bold">
            Preview — what parents will see
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            The real page, exactly as it will look. Nothing here is published
            until you set it on sale.
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-primary/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold ${
                  device === "desktop"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Computer
              </button>
              <button
                type="button"
                onClick={() => setDevice("phone")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold ${
                  device === "phone"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Phone
              </button>
            </div>

            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>

            <a
              href={`/courses/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              Open in a new tab
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <span className="text-xs text-muted-foreground">
              Save your changes first, then press Refresh.
            </span>
          </div>

          <div className="flex justify-center rounded-xl bg-muted/40 p-3">
            <iframe
              key={nonce}
              src={src}
              title="Course page preview"
              className="rounded-lg border border-border bg-white shadow-sm"
              style={{
                width: device === "phone" ? 390 : "100%",
                maxWidth: "100%",
                height: 620,
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
