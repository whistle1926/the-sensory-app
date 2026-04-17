"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Loader2,
  Upload,
  Link as LinkIcon,
  FileText,
  PenLine,
} from "lucide-react";

export type LeafletKind = "content" | "file" | "link";

export interface LeafletValues {
  id?: string;
  title: string;
  description: string;
  category: string;
  kind: LeafletKind;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: LeafletValues;
  suggestedCategories: string[];
  onSaved: () => void;
}

/**
 * Add/edit dialog for a Leaflet. Three modes:
 *   - Write: rich-text body stored in the database (kind = "content")
 *   - Upload: file saved to Vercel Blob (kind = "file")
 *   - Link: external URL (kind = "link")
 *
 * When editing, the current kind is pre-selected. Switching mode inside the
 * dialog wipes the other side's data on save (API clears the unused column).
 */
export function LeafletDialog({
  open,
  onOpenChange,
  initial,
  suggestedCategories,
  onSaved,
}: Props) {
  const isEdit = !!initial?.id;
  const [mode, setMode] = useState<LeafletKind>(initial?.kind ?? "content");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [fileUrl, setFileUrl] = useState(initial?.fileUrl ?? "");
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [mimeType, setMimeType] = useState(initial?.mimeType ?? "");
  const [sizeBytes, setSizeBytes] = useState<number | null>(
    initial?.sizeBytes ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initial?.kind ?? "content");
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setCategory(initial?.category ?? "");
    setContent(initial?.content ?? "");
    setFileUrl(initial?.fileUrl ?? "");
    setFileName(initial?.fileName ?? "");
    setMimeType(initial?.mimeType ?? "");
    setSizeBytes(initial?.sizeBytes ?? null);
    setError("");
  }, [open, initial]);

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/leaflet", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setFileUrl(data.url);
      setFileName(data.filename);
      setMimeType(data.mimeType);
      setSizeBytes(data.sizeBytes);
      if (!title.trim()) {
        setTitle(
          (data.filename as string)
            .replace(/\.[^.]+$/, "")
            .replace(/[_-]+/g, " ")
            .trim(),
        );
      }
    } catch {
      setError("Network error during upload");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (mode === "content") {
      const stripped = content.replace(/<[^>]+>/g, "").trim();
      if (!stripped) {
        setError("Write some content before saving.");
        return;
      }
    } else if (!fileUrl.trim()) {
      setError(mode === "file" ? "Upload a file first." : "Paste a link first.");
      return;
    } else if (mode === "link" && !/^https?:\/\//i.test(fileUrl.trim())) {
      setError("Link must start with http:// or https://");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        kind: mode,
        content: mode === "content" ? content : null,
        fileUrl: mode === "content" ? null : fileUrl.trim(),
        fileName: mode === "content" ? null : fileName,
        mimeType: mode === "content" ? null : mimeType,
        sizeBytes: mode === "content" ? null : sizeBytes,
        external: mode === "link",
      };
      const res = isEdit
        ? await fetch(`/api/leaflets/${initial!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/leaflets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
        return;
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
      active
        ? "bg-background shadow-[var(--shadow-sm)]"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto sm:!max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit leaflet" : "New leaflet"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("content")}
              className={tabClass(mode === "content")}
            >
              <PenLine className="h-3.5 w-3.5" />
              Write
            </button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className={tabClass(mode === "file")}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload file
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={tabClass(mode === "link")}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              External link
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sensory circuits — at home"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input
                list="leaflet-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Fine Motor, Feeding, Regulation"
              />
              <datalist id="leaflet-categories">
                {suggestedCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Short description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown on the gallery card"
              />
            </div>
          </div>

          {/* Body — mode-specific input */}
          {mode === "content" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Leaflet body *</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your leaflet. Use headings, lists, bold, links — and paste a YouTube / Vimeo URL with the video button to embed."
                minHeight={480}
              />
              <p className="text-[11px] text-muted-foreground">
                Stored inside the app — no external file needed.
              </p>
            </div>
          )}

          {mode === "file" && (
            <div>
              <label
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm transition-colors hover:bg-muted ${
                  uploading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : fileUrl ? (
                  <FileText className="h-5 w-5 text-primary" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  {uploading ? (
                    <p>Uploading…</p>
                  ) : fileUrl && fileName ? (
                    <>
                      <p className="truncate font-semibold">{fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {mimeType} · {Math.round((sizeBytes ?? 0) / 1024)} KB — click to replace
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Choose a file to upload</p>
                      <p className="text-xs text-muted-foreground">
                        PDF, image, or doc. Max 20 MB.
                      </p>
                    </>
                  )}
                </div>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                onChange={onFilePick}
                className="hidden"
              />
            </div>
          )}

          {mode === "link" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Link URL *</Label>
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://drive.google.com/... or any public URL"
              />
              <p className="text-[11px] text-muted-foreground">
                Opens in a new tab when clicked. Make sure the link is viewable
                by anyone you'll share it with.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="-mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || uploading}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEdit ? "Save changes" : "Save leaflet"}
            </Button>
          </div>
        </div>

        {/* Optional textarea for longer description — kept out of the grid so
            it doesn't fight with the body field. */}
        <div className="mt-2 space-y-1.5">
          <Label className="text-xs">Internal notes (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="For your own reference — shows on the gallery card preview."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
