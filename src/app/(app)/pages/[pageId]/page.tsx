"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Loader2, Rocket, Undo2 } from "lucide-react";
import { BlockEditor } from "@/components/pages/block-editor";
import { PageBlocksView } from "@/components/pages/page-blocks-view";
import { cleanBlocks, type Block } from "@/lib/page-blocks";

interface PageShape {
  id: string;
  slug: string;
  title: string;
  blocks: unknown;
  draft: Record<string, unknown>;
  isPublished: boolean;
  showInNav: boolean;
  navLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/**
 * Write a page: blocks on the left, the real page on the right.
 *
 * Autosaves to a draft as you type — the live page doesn't move until you
 * press Publish, so a visitor never lands mid-edit.
 */
export default function PageEditor({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = use(params);
  const [page, setPage] = useState<PageShape | null>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [seoDescription, setSeoDescription] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primed = useRef(false);

  async function load() {
    const r = await fetch(`/api/pages/${pageId}`);
    if (!r.ok) return;
    const p = (await r.json()) as PageShape;
    const d = (p.draft ?? {}) as Record<string, unknown>;
    setPage(p);
    setTitle(typeof d.title === "string" ? d.title : p.title);
    setBlocks(cleanBlocks(d.blocks !== undefined ? d.blocks : p.blocks));
    setSeoDescription(
      typeof d.seoDescription === "string" ? d.seoDescription : p.seoDescription ?? "",
    );
    setDirty(Object.keys(d).length > 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Autosave to the draft, a moment after typing stops.
  useEffect(() => {
    if (!page) return;
    if (!primed.current) {
      primed.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks, seoDescription }),
      }).catch(() => {});
      setSaveState("saved");
      setDirty(true);
    }, 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, blocks, seoDescription]);

  async function publish() {
    setPublishing(true);
    try {
      await fetch(`/api/pages/${pageId}/publish`, { method: "POST" });
      setDirty(false);
      await load();
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    if (!confirm("Take this page off the website? The words are kept.")) return;
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: false }),
    });
    await load();
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link
          href="/pages"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All pages
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent text-2xl font-black tracking-tight outline-none hover:border-border focus:border-border focus:bg-background"
            placeholder="Page title"
          />
          <a
            href={`/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-primary/30 bg-primary/[0.04] px-3 py-2 text-xs font-bold hover:bg-primary/[0.08]"
          >
            See the real page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          thesensorysubmarine.com/{page.slug}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="space-y-4">
          <BlockEditor blocks={blocks} onChange={setBlocks} />

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">For Google</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The sentence shown under the link in search results. Leave it
              blank and the page title is used.
            </p>
            <textarea
              rows={2}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Occupational therapy assessments and support for children across Northern Ireland."
            />
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-6rem)]">
          <div className="flex h-full flex-col">
            <p className="mb-2 text-xs text-muted-foreground">
              This is how the page will look. It updates as you type.
            </p>
            <div className="flex-1 overflow-auto rounded-xl border border-border bg-[#FBF8F3] p-5">
              <PageBlocksView blocks={blocks} />
            </div>
          </div>
        </aside>
      </div>

      {/* Save / publish bar */}
      <div className="sticky bottom-4 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          ) : saveState === "saved" ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-600" /> All changes saved
            </>
          ) : page.isPublished ? (
            "Live on the website"
          ) : (
            "Not published yet"
          )}
        </span>

        {dirty && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Unpublished changes
          </span>
        )}

        {page.isPublished && (
          <button
            type="button"
            onClick={unpublish}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            <Undo2 className="h-3.5 w-3.5" /> Take off the website
          </button>
        )}

        <button
          type="button"
          onClick={publish}
          disabled={publishing}
          className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 dark:bg-green-600"
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {page.isPublished ? "Publish changes" : "Publish"}
        </button>
      </div>
    </div>
  );
}
