"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  ExternalLink,
  MessageSquare,
  Send,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendFormDialog } from "@/components/forms/send-form-dialog";

interface FormRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  _count: { submissions: number; invites: number };
}

export default function FormsListPage() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendFor, setSendFor] = useState<FormRow | null>(null);

  useEffect(() => {
    fetch("/api/forms")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setForms(data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forms</h1>
          <p className="mt-1 text-muted-foreground">
            Build intake questionnaires, consent forms, surveys — share the public
            link or email it directly to clients.
          </p>
        </div>
        <Link href="/forms/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Form
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : forms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 font-semibold">No forms yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first form and share it with clients in minutes.
          </p>
          <Link
            href="/forms/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            New Form
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {forms.map((form) => {
            const url =
              typeof window !== "undefined"
                ? `${window.location.origin}/f/${form.slug}`
                : `/f/${form.slug}`;
            return (
              <div
                key={form.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/forms/${form.id}/edit`}
                        className="truncate font-semibold hover:underline"
                      >
                        {form.title}
                      </Link>
                      {form.isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </div>
                    {form.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {form.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {form._count.submissions} response
                        {form._count.submissions === 1 ? "" : "s"}
                      </span>
                      {form._count.invites > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {form._count.invites} sent
                        </span>
                      )}
                      {form.isPublished && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {form.isPublished && (
                      <button
                        type="button"
                        onClick={() => setSendFor(form)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        title="Send form to clients"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </button>
                    )}
                    <Link
                      href={`/forms/${form.id}/entries`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Entries
                    </Link>
                    <Link
                      href={`/forms/${form.id}/edit`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit form"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sendFor && (
        <SendFormDialog
          open={!!sendFor}
          onOpenChange={(o) => !o && setSendFor(null)}
          formId={sendFor.id}
          formTitle={sendFor.title}
        />
      )}
    </div>
  );
}
