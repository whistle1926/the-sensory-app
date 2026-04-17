"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import type { FormField, UploadedFile } from "@/lib/forms";

interface SubmissionRow {
  id: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submittedAt: string;
  data: Record<string, unknown>;
  fieldsSnapshot: FormField[] | unknown;
  invite: {
    id: string;
    email: string;
    client: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

interface FormHeader {
  id: string;
  title: string;
  slug: string;
}

function extractPreview(
  snapshot: unknown,
  data: Record<string, unknown>,
): string {
  if (!Array.isArray(snapshot)) return "";
  const fields = snapshot as FormField[];
  const nonLayout = fields.filter(
    (f) => f.type !== "heading" && f.type !== "paragraph",
  );
  for (const f of nonLayout) {
    const v = data[f.id];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string") return v.slice(0, 80);
    if (typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") {
      const uf = v as UploadedFile;
      if (uf.filename) return uf.filename;
    }
  }
  return "";
}

export default function FormEntriesPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = use(params);
  const [form, setForm] = useState<FormHeader | null>(null);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/forms/${formId}`).then((r) => r.json()),
      fetch(`/api/forms/${formId}/submissions`).then((r) => r.json()),
    ])
      .then(([formData, subs]) => {
        if (formData && !formData.error) {
          setForm({
            id: formData.id,
            title: formData.title,
            slug: formData.slug,
          });
        }
        if (Array.isArray(subs)) setRows(subs);
      })
      .finally(() => setLoading(false));
  }, [formId]);

  return (
    <div className="space-y-5">
      <Link
        href="/forms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to forms
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {form?.title ?? "Entries"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} response{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        {form && (
          <Link
            href={`/forms/${form.id}/edit`}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Edit form
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 font-semibold">No responses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Share the public link or use &quot;Send form&quot; to invite someone.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Submitted</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Preview</th>
                <th className="px-4 py-2.5">From</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/forms/${formId}/entries/${row.id}`}
                      className="text-primary hover:underline"
                    >
                      {new Date(row.submittedAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.submitterName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.submitterEmail ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {extractPreview(row.fieldsSnapshot, row.data) || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {row.invite?.client ? (
                      <Link
                        href={`/clients/${row.invite.client.id}`}
                        className="hover:underline"
                      >
                        {row.invite.client.firstName} {row.invite.client.lastName}
                      </Link>
                    ) : row.invite ? (
                      <>Invited</>
                    ) : (
                      <span>Public link</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
