"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeafletDialog, type LeafletValues } from "@/components/leaflets/leaflet-dialog";
import { cn } from "@/lib/utils";

interface Leaflet {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  thumbnailUrl: string | null;
  tags: string[];
  external: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Leaflet | null>(null);
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
    try {
      await navigator.clipboard.writeText(leaflet.fileUrl);
      setCopiedId(leaflet.id);
      setTimeout(() => setCopiedId((id) => (id === leaflet.id ? null : id)), 1500);
    } catch {
      window.prompt("Copy this link:", leaflet.fileUrl);
    }
  }

  async function remove(leaflet: Leaflet) {
    if (!confirm(`Delete "${leaflet.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/leaflets/${leaflet.id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaflets</h1>
          <p className="mt-1 text-muted-foreground">
            Parent-friendly handouts and info sheets. Upload your own, paste a
            link from Drive, or browse the library.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Leaflet
        </Button>
      </div>

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
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <FileStack className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 font-semibold">
            {leaflets.length === 0 ? "No leaflets yet" : "No matches"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {leaflets.length === 0
              ? "Add your first leaflet — a PDF handout, a diagram, a strategy sheet."
              : "Try a different search term or clear the category filter."}
          </p>
          {leaflets.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              New Leaflet
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((leaflet) => {
            const Icon = iconFor(leaflet.mimeType);
            const isImage = leaflet.mimeType?.startsWith("image/");
            return (
              <div
                key={leaflet.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
              >
                {/* Preview area */}
                <a
                  href={leaflet.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40"
                >
                  {isImage ? (
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
                    <a
                      href={leaflet.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
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
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(leaflet);
                          setDialogOpen(true);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Edit leaflet"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
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

      <LeafletDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={
          editing
            ? ({
                id: editing.id,
                title: editing.title,
                description: editing.description ?? "",
                category: editing.category ?? "",
                fileUrl: editing.fileUrl,
                fileName: editing.fileName,
                mimeType: editing.mimeType,
                sizeBytes: editing.sizeBytes,
                external: editing.external,
              } satisfies LeafletValues)
            : undefined
        }
        suggestedCategories={categories}
        onSaved={load}
      />
    </div>
  );
}
