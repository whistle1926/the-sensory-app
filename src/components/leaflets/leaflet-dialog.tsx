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
import { Loader2, Upload, Link as LinkIcon, FileText, X } from "lucide-react";

export interface LeafletValues {
  id?: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  external: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: LeafletValues;
  suggestedCategories: string[];
  onSaved: () => void;
}

/**
 * Dialog used for both "New leaflet" and "Edit leaflet". Two source modes:
 *   - upload a file (stored on Vercel Blob)
 *   - paste an external URL (e.g. Google Drive share link)
 * When editing, we pre-select whichever mode matches the existing record.
 */
export function LeafletDialog({
  open,
  onOpenChange,
  initial,
  suggestedCategories,
  onSaved,
}: Props) {
  const isEdit = !!initial?.id;
  const [mode, setMode] = useState<"upload" | "link">(
    initial?.external ? "link" : "upload",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
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
    setMode(initial?.external ? "link" : "upload");
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setCategory(initial?.category ?? "");
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
      // Default the title to the filename stripped of extension if blank.
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
    if (!fileUrl.trim()) {
      setError(mode === "upload" ? "Upload a file first." : "Paste a link first.");
      return;
    }
    if (mode === "link" && !/^https?:\/\//i.test(fileUrl.trim())) {
      setError("Link must start with http:// or https://");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        fileUrl: fileUrl.trim(),
        fileName,
        mimeType,
        sizeBytes,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit leaflet" : "Add leaflet"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                mode === "upload"
                  ? "bg-background shadow-[var(--shadow-sm)]"
                  : "text-muted-foreground"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload a file
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                mode === "link"
                  ? "bg-background shadow-[var(--shadow-sm)]"
                  : "text-muted-foreground"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              External link
            </button>
          </div>

          {mode === "upload" ? (
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
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Link URL</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sensory circuits — at home"
            />
          </div>

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
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short note for the library: who it's for, when to use it."
            />
          </div>

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
              ) : (
                <X className="mr-2 hidden h-4 w-4" />
              )}
              {isEdit ? "Save changes" : "Add to library"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
