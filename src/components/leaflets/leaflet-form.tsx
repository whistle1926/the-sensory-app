"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  ArrowLeft,
  Loader2,
  Upload,
  Link as LinkIcon,
  FileText,
  PenLine,
  Save,
  Trash2,
} from "lucide-react";

export type LeafletKind = "content" | "file" | "link";

export interface LeafletFormValues {
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
  leafletId?: string;
  initial: LeafletFormValues;
  suggestedCategories: string[];
}

/**
 * Full-page editor for a Leaflet. Used by /leaflets/new and
 * /leaflets/[id]/edit. Three source modes sharing the same page chrome:
 *   - Write   — rich-text body stored in the database (kind = "content")
 *   - Upload  — file saved to Vercel Blob                (kind = "file")
 *   - Link    — external URL                             (kind = "link")
 */
export function LeafletForm({ leafletId, initial, suggestedCategories }: Props) {
  const router = useRouter();
  const isEdit = !!leafletId;
  const [mode, setMode] = useState<LeafletKind>(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [content, setContent] = useState(initial.content ?? "");
  const [fileUrl, setFileUrl] = useState(initial.fileUrl ?? "");
  const [fileName, setFileName] = useState(initial.fileName ?? "");
  const [mimeType, setMimeType] = useState(initial.mimeType ?? "");
  const [sizeBytes, setSizeBytes] = useState<number | null>(
    initial.sizeBytes ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        ? await fetch(`/api/leaflets/${leafletId}`, {
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
      router.push("/leaflets");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!leafletId) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/leaflets/${leafletId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/leaflets");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
      active
        ? "bg-background shadow-[var(--shadow-sm)]"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/leaflets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaflets
        </Link>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          )}
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEdit ? "Save changes" : "Save leaflet"}
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        {isEdit ? "Edit leaflet" : "New leaflet"}
      </h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1 text-sm">
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

        {mode === "content" && (
          <div>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your leaflet. Use headings, lists, bold, links — and paste a YouTube / Vimeo URL with the video button to embed."
              minHeight={520}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Stored inside the app — no external file needed.
            </p>
          </div>
        )}

        {mode === "file" && (
          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>
        )}

        {mode === "link" && (
          <Card>
            <CardContent className="space-y-1.5 pt-6">
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
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="For your own reference — shows on the gallery card preview."
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || uploading}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isEdit ? "Save changes" : "Save leaflet"}
        </Button>
        <Link
          href="/leaflets"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
