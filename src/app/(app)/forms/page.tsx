"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendFormDialog } from "@/components/forms/send-form-dialog";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

interface FormRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  settings: { requireLogin?: boolean } | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  _count: { submissions: number; invites: number };
}

/**
 * Forms — admin list. KPI strip up top (published/drafts/submissions/invites),
 * then one row per form inside a Panel with inline actions.
 */
export default function FormsListPage() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendFor, setSendFor] = useState<FormRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyLink(formId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(formId);
      setTimeout(() => setCopiedId((id) => (id === formId ? null : id)), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  useEffect(() => {
    fetch("/api/forms")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setForms(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const published = forms.filter((f) => f.isPublished).length;
    const drafts = forms.length - published;
    const submissions = forms.reduce((s, f) => s + f._count.submissions, 0);
    const invites = forms.reduce((s, f) => s + f._count.invites, 0);
    return [
      {
        label: "Live forms",
        value: String(published),
        helper: `${drafts} draft${drafts === 1 ? "" : "s"}`,
        icon: Globe,
        accent: false,
      },
      {
        label: "Responses",
        value: String(submissions),
        helper: `${forms.length} form${forms.length === 1 ? "" : "s"} total`,
        icon: MessageSquare,
        accent: false,
      },
      {
        label: "Sent",
        value: String(invites),
        helper: "Personal invites",
        icon: Send,
        accent: false,
      },
      {
        label: "Drafts",
        value: String(drafts),
        helper: drafts === 0 ? "Nothing pending" : "Not published",
        icon: ClipboardList,
        accent: drafts > 0,
      },
    ];
  }, [forms]);

  return (
    <div className="space-y-6">
      <Toolbar
        title="Forms"
        subtitle="Build intake questionnaires, consent forms, surveys — share the public link or email it directly to clients."
        actions={
          <Link href="/forms/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Form
            </Button>
          </Link>
        }
      />

      {loading ? (
        <Panel>
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </Panel>
      ) : forms.length === 0 ? (
        <Panel>
          <div className="ds-empty">
            <ClipboardList
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No forms yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
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
        </Panel>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className={`ds-kpi ${k.accent ? "accent" : ""}`}
                >
                  <div className="ds-kpi-head">
                    <span className="ds-kpi-label">{k.label}</span>
                    <span className="ds-kpi-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <span className="ds-kpi-value ds-tabular">{k.value}</span>
                  <div className="ds-kpi-foot">
                    <span>{k.helper}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form rows */}
          <Panel
            footer={
              <span>
                {forms.length} {forms.length === 1 ? "form" : "forms"}
              </span>
            }
          >
            <div className="divide-y divide-border">
              {forms.map((form) => {
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/f/${form.slug}`
                    : `/f/${form.slug}`;
                return (
                  <div key={form.id} className="px-5 py-4">
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
                            <Chip tone="success">Live</Chip>
                          ) : (
                            <Chip tone="neutral" dot={false}>
                              Draft
                            </Chip>
                          )}
                          {form.settings?.requireLogin ? (
                            <Chip tone="warn">
                              <Lock className="h-2.5 w-2.5" />
                              Sign-in required
                            </Chip>
                          ) : (
                            <Chip tone="info">
                              <Globe className="h-2.5 w-2.5" />
                              Public
                            </Chip>
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
                            onClick={() => copyLink(form.id, url)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                            title="Copy public link"
                          >
                            {copiedId === form.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy link
                              </>
                            )}
                          </button>
                        )}
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
          </Panel>
        </>
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
