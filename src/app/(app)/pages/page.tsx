"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Loader2, Plus } from "lucide-react";

interface PageRow {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  showInNav: boolean;
  updatedAt: string;
  draft: unknown;
}

/** Website pages you can write yourself — About, Services, and so on. */
export default function PagesListPage() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/pages");
    if (r.ok) {
      const j = (await r.json()) as { pages?: PageRow[] };
      setPages(j.pages ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    try {
      const r = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New page" }),
      });
      const j = (await r.json()) as { page?: { id: string } };
      if (j.page) window.location.href = `/pages/${j.page.id}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website pages</h1>
          <p className="text-sm text-muted-foreground">
            Pages you can write and change yourself — no developer needed.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New page
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No pages yet. Make one for About, Services, or anything else you
            want on the website.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((p) => {
            const pending = p.draft && Object.keys(p.draft).length > 0;
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {p.title}
                    {p.isPublished ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-950/40 dark:text-green-300">
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Not published
                      </span>
                    )}
                    {pending ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        Unpublished changes
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    /p/{p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border p-2 hover:bg-muted"
                    aria-label="View page"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Link
                    href={`/pages/${p.id}`}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
