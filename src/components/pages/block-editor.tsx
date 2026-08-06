"use client";

import { useRef, useState } from "react";
import { upload as blobUpload } from "@vercel/blob/client";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BLOCK_LABELS,
  emptyBlock,
  newId,
  type Block,
  type BlockType,
} from "@/lib/page-blocks";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const ORDER: BlockType[] = [
  "heading",
  "text",
  "image",
  "buttons",
  "cards",
  "quote",
  "spacer",
];

/**
 * Build a page out of blocks.
 *
 * Each block only ever collects words and links — never styling. That keeps
 * every page on-brand however it's assembled, and means the look can be
 * changed later in one place rather than page by page.
 */
export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (next: Block[]) => void;
}) {
  function update(id: string, patch: Partial<Block>) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  }
  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add(type: BlockType) {
    onChange([...blocks, emptyBlock(type)]);
  }

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <section
          key={b.id}
          className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {BLOCK_LABELS[b.type]}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(b.id, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(b.id, 1)}
                disabled={i === blocks.length - 1}
                aria-label="Move down"
                className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(b.id)}
                aria-label="Delete this block"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <BlockFields block={b} onChange={(patch) => update(b.id, patch)} />
        </section>
      ))}

      <div className="rounded-2xl border-2 border-dashed border-border p-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Add to the page
        </p>
        <div className="flex flex-wrap gap-2">
          {ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => add(t)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

const input =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function BlockFields({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Heading">
            <input
              className={input}
              value={block.text}
              onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
              placeholder="e.g. How we can help"
            />
          </Field>
          <Field label="Size">
            <select
              className={input}
              value={block.level}
              onChange={(e) =>
                onChange({ level: Number(e.target.value) === 1 ? 1 : 2 } as Partial<Block>)
              }
            >
              <option value={1}>Big (page title)</option>
              <option value={2}>Section</option>
            </select>
          </Field>
        </div>
      );

    case "text":
      return (
        <Field label="Words">
          <RichTextEditor
            value={block.html}
            onChange={(html) => onChange({ html } as Partial<Block>)}
            maxHeight={300}
            placeholder="Write here…"
          />
        </Field>
      );

    case "image":
      return (
        <div className="space-y-3">
          {block.url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={block.url}
              alt=""
              className="max-h-48 w-full rounded-xl border border-border object-cover"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const blob = await blobUpload(f.name, f, {
                  access: "public",
                  handleUploadUrl: "/api/uploads/blob",
                });
                onChange({ url: blob.url } as Partial<Block>);
              } finally {
                setUploading(false);
                if (fileRef.current) fileRef.current.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {block.url ? "Change picture" : "Upload a picture"}
          </button>
          <Field label="Description of the picture (for screen readers)">
            <input
              className={input}
              value={block.alt}
              onChange={(e) => onChange({ alt: e.target.value } as Partial<Block>)}
              placeholder="e.g. A child playing with a sensory tray"
            />
          </Field>
          <Field label="Caption (optional)">
            <input
              className={input}
              value={block.caption ?? ""}
              onChange={(e) => onChange({ caption: e.target.value } as Partial<Block>)}
            />
          </Field>
        </div>
      );

    case "buttons":
      return (
        <div className="space-y-3">
          {block.items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                className={input}
                value={it.label}
                placeholder="Button text"
                onChange={(e) => {
                  const items = [...block.items];
                  items[i] = { ...it, label: e.target.value };
                  onChange({ items } as Partial<Block>);
                }}
              />
              <input
                className={input}
                value={it.href}
                placeholder="/book or https://…"
                onChange={(e) => {
                  const items = [...block.items];
                  items[i] = { ...it, href: e.target.value };
                  onChange({ items } as Partial<Block>);
                }}
              />
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={!!it.primary}
                  onChange={(e) => {
                    const items = [...block.items];
                    items[i] = { ...it, primary: e.target.checked };
                    onChange({ items } as Partial<Block>);
                  }}
                />
                Main
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({ items: block.items.filter((_, j) => j !== i) } as Partial<Block>)
                }
                aria-label="Remove button"
                className="rounded-lg p-2 text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {block.items.length < 4 && (
            <button
              type="button"
              onClick={() =>
                onChange({ items: [...block.items, { label: "", href: "" }] } as Partial<Block>)
              }
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Add another button
            </button>
          )}
        </div>
      );

    case "cards":
      return (
        <div className="space-y-3">
          {block.items.map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <input
                    className={input}
                    value={c.title}
                    placeholder="Card title"
                    onChange={(e) => {
                      const items = [...block.items];
                      items[i] = { ...c, title: e.target.value };
                      onChange({ items } as Partial<Block>);
                    }}
                  />
                  <textarea
                    rows={2}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    value={c.body}
                    placeholder="A sentence or two"
                    onChange={(e) => {
                      const items = [...block.items];
                      items[i] = { ...c, body: e.target.value };
                      onChange({ items } as Partial<Block>);
                    }}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={input}
                      value={c.href ?? ""}
                      placeholder="Link (optional)"
                      onChange={(e) => {
                        const items = [...block.items];
                        items[i] = { ...c, href: e.target.value };
                        onChange({ items } as Partial<Block>);
                      }}
                    />
                    <input
                      className={input}
                      value={c.cta ?? ""}
                      placeholder="Link text"
                      onChange={(e) => {
                        const items = [...block.items];
                        items[i] = { ...c, cta: e.target.value };
                        onChange({ items } as Partial<Block>);
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ items: block.items.filter((_, j) => j !== i) } as Partial<Block>)
                  }
                  aria-label="Remove card"
                  className="rounded-lg p-2 text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {block.items.length < 8 && (
            <button
              type="button"
              onClick={() =>
                onChange({ items: [...block.items, { title: "", body: "" }] } as Partial<Block>)
              }
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Add another card
            </button>
          )}
        </div>
      );

    case "quote":
      return (
        <div className="space-y-3">
          <Field label="What they said">
            <textarea
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              value={block.text}
              onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
            />
          </Field>
          <Field label="Who said it">
            <input
              className={input}
              value={block.author ?? ""}
              onChange={(e) => onChange({ author: e.target.value } as Partial<Block>)}
              placeholder="e.g. Bronagh, parent"
            />
          </Field>
        </div>
      );

    case "spacer":
      return (
        <p className="text-xs text-muted-foreground">
          A gap on the page. Nothing to fill in.
        </p>
      );

    default:
      return null;
  }
}

export { newId };
