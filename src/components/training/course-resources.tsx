"use client";

import { useEffect, useRef, useState } from "react";
import { upload as blobUpload } from "@vercel/blob/client";
import { FileText, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  url: string;
  kind: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

/**
 * Handouts attached to a course — the "couple of resources with each webinar".
 *
 * Files go straight from the browser to Vercel Blob and only the resulting URL
 * is posted to our API. That's deliberate: a serverless request body is capped
 * around 4.5MB, and routing a PDF or PowerPoint through the function is what
 * previously made uploads hang forever with no error.
 *
 * Saves immediately rather than waiting for the page's Save button — an upload
 * that silently depends on a later click is the kind of thing that loses work.
 */
export function CourseResources({ courseId }: { courseId: string }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/courses/${courseId}/resources`);
      const json = (await res.json()) as { resources?: Resource[] };
      setResources(json.resources ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function add(body: Record<string, unknown>) {
    const res = await fetch(`/api/courses/${courseId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "Couldn't add that.");
    }
    await load();
  }

  async function onPick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await blobUpload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/blob",
      });
      await add({
        url: blob.url,
        title: file.name.replace(/\.[^.]+$/, ""),
        kind: "file",
        mimeType: file.type,
        sizeBytes: file.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await add({
        url: linkUrl.trim(),
        title: linkTitle.trim() || linkUrl.trim(),
        kind: "link",
      });
      setLinkUrl("");
      setLinkTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that link.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this handout from the course?")) return;
    setBusy(true);
    try {
      await fetch(`/api/courses/${courseId}/resources/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <h2 className="text-sm font-semibold">Handouts &amp; resources</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Worksheets, checklists or slides that go with this course. Parents can
        download them alongside the video. Saved as soon as you add them.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {resources.length > 0 && (
            <ul className="mt-4 space-y-2">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                  >
                    {r.kind === "link" ? (
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">{r.title}</span>
                    {r.sizeBytes ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(r.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    ) : null}
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={busy}
                    aria-label={`Remove ${r.title}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload a file
            </button>
            <span className="text-xs text-muted-foreground">
              PDF, Word, PowerPoint or an image — up to 100MB.
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold">Or link to something online</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="What it's called"
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={addLink}
                disabled={busy || !linkUrl.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
