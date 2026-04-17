"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormField, UploadedFile } from "@/lib/forms";

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
    </div>
  );
}
