"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";

interface LinkRow {
  label: string;
  hint: string;
  url: string;
}

/**
 * Every public link in one place, ready to copy.
 *
 * Grace kept asking "what's the link to X?" so she could paste it into her Wix
 * site, an email or a social post — and the answer lived in three different
 * places. This lists them all with a copy button, and includes a row per
 * course that's currently on sale, since those are the ones she's promoting.
 */
export function ShareLinksSection() {
  const [courses, setCourses] = useState<Array<{ slug: string; title: string }>>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://portal.thesensorysubmarine.com");

  useEffect(() => {
    // Use whatever host the admin is actually on, so a link copied from a
    // preview deploy doesn't silently point at production.
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    fetch("/api/courses/public")
      .then((r) => r.json())
      .then((data: Array<{ slug: string; title: string }>) =>
        setCourses(Array.isArray(data) ? data : []),
      )
      .catch(() => {});
  }, []);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
    } catch {
      /* clipboard blocked — the text is selectable anyway */
    }
  }

  const rows: LinkRow[] = [
    {
      label: "Book a session",
      hint: "The public booking page. This is the one to put on your website.",
      url: "https://book.thesensorysubmarine.com",
    },
    {
      label: "Parent portal — sign in",
      hint: "Where existing families log in to see courses and appointments.",
      url: `${origin}/login`,
    },
    {
      label: "Create an account",
      hint: "For a parent who hasn't used the portal before.",
      url: `${origin}/register`,
    },
    {
      label: "All courses",
      hint: "The public course list. Only shows courses you've put on sale.",
      url: `${origin}/courses`,
    },
    ...courses.map((c) => ({
      label: c.title,
      hint: "Straight to this course's page — good for a social post or email.",
      url: `${origin}/courses/${c.slug}`,
    })),
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Links to share</h2>
          <p className="text-xs text-muted-foreground">
            Copy any of these straight into your website, an email or a social
            post.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.url}
            className="rounded-xl border border-border bg-background p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{r.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.hint}</p>
                <p className="mt-1.5 break-all font-mono text-[11px] text-muted-foreground">
                  {r.url}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => copy(r.url)}
                  title="Copy this link"
                  aria-label={`Copy link to ${r.label}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  {copied === r.url ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in a new tab"
                  aria-label={`Open ${r.label}`}
                  className="inline-flex items-center rounded-lg border border-border px-2.5 py-2 hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
