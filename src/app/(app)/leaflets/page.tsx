"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileStack,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Copy,
  Check,
  Search,
  Loader2,
  FileText,
  Image as ImageIcon,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Toolbar, Panel, Empty } from "@/components/ds";

interface Leaflet {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  kind: "content" | "file" | "link";
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  tags: string[];
  external: boolean;
  createdAt: string;
  updatedAt: string;
}

function plainTextFromHtml(html: string | null, chars = 120): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities so the card preview reads as text
    // ("Nail & Skin", curly quotes) rather than raw "&amp;" / "&rsquo;".
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "’")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, chars);
}

function iconFor(mimeType: string | null | undefined) {
  if (!mimeType) return FileText;
  if (mimeType.startsWith("image/")) return ImageIcon;
  return FileText;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function LeafletsPage() {
  const [leaflets, setLeaflets] = useState<Leaflet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/leaflets");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setLeaflets(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of leaflets) if (l.category) set.add(l.category);
    return Array.from(set).sort();
  }, [leaflets]);

  const kpis = useMemo(() => {
    const written = leaflets.filter((l) => l.kind === "content").length;
    const files = leaflets.filter((l) => l.kind === "file").length;
    const links = leaflets.filter((l) => l.kind === "link" || l.external).length;
    return [
      {
        label: "Total leaflets",
        value: String(leaflets.length),
        helper: `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`,
        icon: FileStack,
      },
      {
        label: "Written",
        value: String(written),
        helper: "In-app articles",
        icon: PenLine,
      },
      {
        label: "Files",
        value: String(files),
        helper: "PDFs, images",
        icon: FileText,
      },
      {
        label: "External",
        value: String(links),
        helper: "Drive links, sites",
        icon: ExternalLink,
      },
    ];
  }, [leaflets, categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaflets.filter((l) => {
      if (activeCategory && l.category !== activeCategory) return false;
      if (!q) return true;
      const hay = [
        l.title,
        l.description ?? "",
        l.category ?? "",
        (l.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leaflets, search, activeCategory]);

  async function copyLink(leaflet: Leaflet) {
    // For content-kind leaflets copy the in-app view page URL; for file/link
    // copy the blob / external URL directly.
    const url =
      leaflet.kind === "content"
        ? `${window.location.origin}/leaflets/${leaflet.id}`
        : (leaflet.fileUrl ?? "");
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(leaflet.id);
      setTimeout(() => setCopiedId((id) => (id === leaflet.id ? null : id)), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function remove(leaflet: Leaflet) {
    if (!confirm(`Delete "${leaflet.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/leaflets/${leaflet.id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <Toolbar
        title="Leaflets"
        subtitle="Parent-friendly handouts and info sheets. Upload your own, paste a link from Drive, or browse the library."
        actions={
          <Link href="/leaflets/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Leaflet
            </Button>
          </Link>
        }
      />

      {!loading && leaflets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="ds-kpi">
                <div className="ds-kpi-head">
                  <span className="ds-kpi-label">{k.label}</span>
                  <span className="ds-kpi-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <span className="ds-kpi-value ds-tabular">{k.value}</span>
                <div className="ds-kpi-foot">
                  <span>{k.helper}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, descriptions, tags…"
            className="pl-8"
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
              activeCategory === null
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
            )}
          >
            All
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                activeCategory === null ? "bg-white/25" : "bg-muted",
              )}
            >
              {leaflets.length}
            </span>
          </button>
          {categories.map((c) => {
            const count = leaflets.filter((l) => l.category === c).length;
            const active = activeCategory === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(active ? null : c)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                    : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
                )}
              >
                {c}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                    active ? "bg-white/25" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <Panel>
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <div className="ds-empty">
            <FileStack
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              {leaflets.length === 0 ? "No leaflets yet" : "No matches"}
            </p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              {leaflets.length === 0
                ? "Add your first leaflet — a PDF handout, a diagram, a strategy sheet."
                : "Try a different search term or clear the category filter."}
            </p>
            {leaflets.length === 0 && (
              <Link
                href="/leaflets/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                New Leaflet
              </Link>
            )}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((leaflet) => {
            const Icon = iconFor(leaflet.mimeType);
            const isImage =
              leaflet.kind === "file" &&
              leaflet.mimeType?.startsWith("image/");
            // Open target depends on kind: content → in-app view; file/link → new tab
            const openHref =
              leaflet.kind === "content"
                ? `/leaflets/${leaflet.id}`
                : (leaflet.fileUrl ?? "#");
            const openExternal = leaflet.kind !== "content";
            const preview = plainTextFromHtml(leaflet.content);
            return (
              <div
                key={leaflet.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
              >
                {/* Preview area */}
                {openExternal ? (
                  <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40"
                  >
                    {leaflet.coverImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={leaflet.coverImageUrl}
                        alt={leaflet.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : isImage && leaflet.fileUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={leaflet.fileUrl}
                        alt={leaflet.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : leaflet.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={leaflet.thumbnailUrl}
                        alt={leaflet.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-12 w-12 text-muted-foreground/30" />
                    )}
                    {leaflet.external && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-sm">
                        <ExternalLink className="h-2.5 w-2.5" />
                        External
                      </span>
                    )}
                    {leaflet.category && (
                      <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                        {leaflet.category}
                      </span>
                    )}
                  </a>
                ) : (
                  <Link
                    href={openHref}
                    className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 to-primary/15"
                  >
                    {leaflet.coverImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={leaflet.coverImageUrl}
                        alt={leaflet.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="p-4 text-center">
                        <PenLine className="mx-auto h-8 w-8 text-primary/50" />
                        <p className="mt-2 line-clamp-4 text-xs italic text-muted-foreground">
                          {preview || "Written leaflet"}
                        </p>
                      </div>
                    )}
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-primary shadow-sm">
                      <PenLine className="h-2.5 w-2.5" />
                      Written
                    </span>
                    {leaflet.category && (
                      <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                        {leaflet.category}
                      </span>
                    )}
                  </Link>
                )}

                {/* Body */}
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold">
                    {leaflet.title}
                  </h3>
                  {leaflet.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {leaflet.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {leaflet.fileName && (
                      <span className="truncate">{leaflet.fileName}</span>
                    )}
                    {leaflet.sizeBytes ? (
                      <span>· {formatSize(leaflet.sizeBytes)}</span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2.5">
                    {openExternal ? (
                      <a
                        href={openHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    ) : (
                      <Link
                        href={openHref}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        <PenLine className="h-3 w-3" />
                        Read
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => copyLink(leaflet)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {copiedId === leaflet.id ? (
                        <>
                          <Check className="h-3 w-3 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy link
                        </>
                      )}
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <Link
                        href={`/leaflets/${leaflet.id}/edit`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Edit leaflet"
                      >
                        <Pencil className="h-3 w-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(leaflet)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete leaflet"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
