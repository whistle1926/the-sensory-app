"use client";

import { useRef, useState } from "react";
import { upload as blobUpload } from "@vercel/blob/client";
import { Loader2, Sparkles, Trash2, Upload } from "lucide-react";

/**
 * A course image: upload one, draw one from the course's own content, or paste
 * a link.
 *
 * Uploads go browser-to-blob so a big photo can't hit the ~4.5MB serverless
 * body cap. A generated picture is put in the field for approval rather than
 * saved, because it's the face of a paid product and should be a choice, not
 * a surprise.
 */
export function CourseImageField({
  label,
  hint,
  value,
  onChange,
  courseId,
  kind,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  courseId: string;
  kind: "hero" | "thumbnail";
}) {
  const [busy, setBusy] = useState<"upload" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const blob = await blobUpload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/blob",
      });
      onChange(blob.url);
    } catch {
      setError("Couldn't upload that image.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function draw() {
    setBusy("ai");
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Couldn't draw a picture.");
      onChange(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draw a picture.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {value && (
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            title="Remove this image"
            aria-label="Remove image"
            className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          {busy === "upload" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload a picture
        </button>

        <button
          type="button"
          onClick={draw}
          disabled={busy !== null}
          title="Draws an illustration from this course's title and description"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy === "ai" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {busy === "ai" ? "Drawing…" : "Create one for me"}
        </button>
      </div>

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a link"
        className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
      />

      {busy === "ai" && (
        <p className="text-xs text-muted-foreground">
          This takes about 20 seconds.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
