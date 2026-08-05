"use client";

import { useRef, useState } from "react";
import { upload as blobUpload } from "@vercel/blob/client";
import { Loader2, Trash2, Upload } from "lucide-react";

/**
 * The instructor's photo — upload one rather than hunting for a URL.
 *
 * Shown as a circle on the course page, so a square picture is what's wanted;
 * the size is stated up front and a wrong shape is flagged before it's saved.
 */
export function InstructorPhotoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);

    // Flag a non-square picture — it's cropped to a circle on the page.
    const objectUrl = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      const r = probe.width / probe.height;
      setWarn(
        Math.abs(r - 1) > 0.15
          ? `That photo is ${probe.width} × ${probe.height}. It's shown as a circle, so a square picture (about 400 × 400) keeps the face centred.`
          : null,
      );
      URL.revokeObjectURL(objectUrl);
    };
    probe.onerror = () => URL.revokeObjectURL(objectUrl);
    probe.src = objectUrl;

    try {
      const blob = await blobUpload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/blob",
      });
      onChange(blob.url);
    } catch {
      setError("Couldn't upload that photo.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Photo
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
          400 × 400 px
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Square works best — it&apos;s shown as a circle on the course page.
      </p>

      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Remove photo"
              className="absolute -right-1 -top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
            No photo
          </div>
        )}

        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {value ? "Change photo" : "Upload a photo"}
        </button>
      </div>

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a link"
        className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
      />

      {warn && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {warn}
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
