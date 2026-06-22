"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2, Forward, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormField, UploadedFile } from "@/lib/forms";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Submission {
  id: string;
  formId: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submittedAt: string;
  data: Record<string, unknown>;
  fieldsSnapshot: FormField[] | unknown;
  form: { id: string; title: string; slug: string };
  invite: {
    id: string;
    email: string;
    client: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

function ValueView({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (Array.isArray(value)) {
    return <>{value.map(String).join(", ")}</>;
  }
  if (typeof value === "object" && value !== null) {
    const uf = value as UploadedFile;
    if (uf.url && uf.filename) {
      return (
        <a
          href={uf.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {uf.filename}{" "}
          <span className="text-xs text-muted-foreground">
            ({Math.round(uf.sizeBytes / 1024)} KB)
          </span>
        </a>
      );
    }
  }
  return <span className="whitespace-pre-line">{String(value)}</span>;
}

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ formId: string; submissionId: string }>;
}) {
  const { formId, submissionId } = use(params);
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // ── Forward-to-OT dialog state ──────────────────────────────────
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleForward() {
    const to = forwardTo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setSendError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(
        `/api/forms/${formId}/submissions/${submissionId}/forward`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, note: forwardNote.trim() }),
        },
      );
      const result = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(result.error || `Send failed (${res.status})`);
      }
      setSentTo(to);
      setForwardOpen(false);
      setForwardTo("");
      setForwardNote("");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    fetch(`/api/forms/${formId}/submissions/${submissionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setSubmission(data);
      })
      .finally(() => setLoading(false));
  }, [formId, submissionId]);

  async function handleDelete() {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(
      `/api/forms/${formId}/submissions/${submissionId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      router.push(`/forms/${formId}/entries`);
    } else {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!submission) {
    return (
      <div>
        <Link
          href={`/forms/${formId}/entries`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">Submission not found.</p>
      </div>
    );
  }

  const snapshot = Array.isArray(submission.fieldsSnapshot)
    ? (submission.fieldsSnapshot as FormField[])
    : [];
  const data = submission.data as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <Link
        href={`/forms/${formId}/entries`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to entries
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {submission.form.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted{" "}
            {new Date(submission.submittedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {submission.submitterName && <> by {submission.submitterName}</>}
            {submission.submitterEmail && (
              <>
                {" "}
                &lt;
                <a
                  href={`mailto:${submission.submitterEmail}`}
                  className="hover:underline"
                >
                  {submission.submitterEmail}
                </a>
                &gt;
              </>
            )}
          </p>
          {submission.invite?.client && (
            <p className="mt-1 text-sm text-muted-foreground">
              Linked to client:{" "}
              <Link
                href={`/clients/${submission.invite.client.id}`}
                className="text-primary hover:underline"
              >
                {submission.invite.client.firstName}{" "}
                {submission.invite.client.lastName}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSendError(null);
              setForwardOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Forward className="h-3.5 w-3.5" />
            Forward to OT
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Confirmation after a successful forward. */}
      {sentTo && (
        <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800/60 dark:bg-green-950/30 dark:text-green-300">
          <Check className="h-4 w-4" />
          Referral sent to <strong>{sentTo}</strong>.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <dl className="space-y-5">
          {snapshot.map((field) => {
            if (field.type === "heading") {
              return (
                <h2
                  key={field.id}
                  className="pt-2 text-base font-bold tracking-tight"
                >
                  {field.label}
                </h2>
              );
            }
            if (field.type === "paragraph") {
              return (
                <p
                  key={field.id}
                  className="whitespace-pre-line text-sm text-muted-foreground"
                >
                  {field.label}
                </p>
              );
            }
            return (
              <div key={field.id}>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {field.label || "(Untitled)"}
                </dt>
                <dd className="mt-1 text-sm">
                  <ValueView value={data[field.id]} />
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* Forward-to-OT dialog */}
      <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward to another OT</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Email a read-only copy of this referral to a colleague. They
              don&apos;t need an account to view it.
            </p>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient email
              </label>
              <input
                type="email"
                value={forwardTo}
                onChange={(e) => {
                  setForwardTo(e.target.value);
                  if (sendError) setSendError(null);
                }}
                placeholder="colleague@example.com"
                autoFocus
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Note (optional)
              </label>
              <textarea
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
                rows={3}
                placeholder="Add a short message for your colleague…"
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {sendError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {sendError}
              </p>
            )}
          </div>
          <div className="-mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3">
            <button
              type="button"
              onClick={() => setForwardOpen(false)}
              disabled={sending}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForward}
              disabled={sending || !forwardTo.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Forward className="h-3.5 w-3.5" />
              )}
              {sending ? "Sending…" : "Send referral"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
