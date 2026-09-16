"use client";

/**
 * Client record → Documents.
 *
 * A place to keep arbitrary documents alongside a client that aren't a
 * structured assessment: letters received, external/school reports, a
 * scanned form — anything the OT wants filed in the folder. Complements
 * the Assessments & forms section (Grace's ask, Sept 2026: "add in more
 * than just the SPM… another document, or letters that have been sent to
 * me"). Upload reuses the existing blob route (/api/uploads/intake-file);
 * metadata is stored per-client via /api/clients/[id]/documents.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { Panel, Empty } from "@/components/ds";

export interface ClientDoc {
  id: string;
  title: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ClientDocumentsSection({
  clientId,
  initialDocs,
}: {
  clientId: string;
  initialDocs: ClientDoc[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<ClientDoc[]>(initialDocs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Upload the file to blob (staff-only route, 25 MB cap).
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/uploads/intake-file", { method: "POST", body: fd });
      if (!up.ok) {
        const d = (await up.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Upload failed");
      }
      const meta = (await up.json()) as {
        url: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      };
      // 2. File it against this client.
      const save = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
      if (!save.ok) {
        const d = (await save.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Couldn't save the document");
      }
      const doc = (await save.json()) as ClientDoc;
      setDocs((prev) => [doc, ...prev]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Couldn't remove the document");
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setConfirmId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Documents
        </span>
      }
      padded
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={onPicked}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload document
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Letters, external reports, or anything else you want kept in this
        client&rsquo;s folder. PDF, Word, image or text — up to 25 MB.
      </p>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {docs.length === 0 ? (
        <Empty>No documents yet.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {prettyDate(d.createdAt)} &middot; {prettySize(d.sizeBytes)}
                </p>
              </div>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Open
              </a>
              {confirmId === d.id ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(d.id)}
                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(d.id)}
                  aria-label="Delete document"
                  className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
