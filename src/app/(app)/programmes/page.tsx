"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Home,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Section {
  title: string;
  items: string[];
}

interface ProgrammeTemplate {
  id: string;
  title: string;
  description: string;
  sections: unknown; // Json — we coerce when rendering
}

interface Report {
  id: string;
  reportDate: string;
  status: string;
  content: {
    clientInfo: { clientName: string };
    homeProgrammeSuggestions: string;
    goals: { shortTerm: string; longTerm: string };
    recommendations: string;
  };
  client: { firstName: string; lastName: string };
}

function coerceSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const e = (s || {}) as { title?: unknown; items?: unknown };
    return {
      title: typeof e.title === "string" ? e.title : "",
      items: Array.isArray(e.items)
        ? e.items.filter((x): x is string => typeof x === "string")
        : [],
    };
  });
}

export default function ProgrammesPage() {
  const { data: session } = useSession();
  const canEdit = session?.user?.role !== "CLIENT";

  const [programmes, setProgrammes] = useState<ProgrammeTemplate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/programmes").then((r) => r.json()),
      fetch("/api/reports").then((r) => r.json()),
    ])
      .then(([progs, reps]) => {
        const list: ProgrammeTemplate[] = Array.isArray(progs) ? progs : [];
        setProgrammes(list);
        setReports(Array.isArray(reps) ? reps : []);
        if (list.length > 0) setExpandedTemplate(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const reportsWithProgrammes = reports.filter(
    (r) =>
      r.content?.homeProgrammeSuggestions &&
      r.content.homeProgrammeSuggestions.length > 0,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home Programmes</h1>
          <p className="mt-1 text-muted-foreground">
            Structured home programmes and templates for parents and carers
          </p>
        </div>
        {canEdit && (
          <Link href="/programmes/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Programme
            </Button>
          </Link>
        )}
      </div>

      {/* Programme Templates */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Programme Templates
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
            {programmes.length}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
            <p className="text-muted-foreground">Loading programmes…</p>
          </div>
        ) : programmes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-medium">No programme templates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first programme to share with parents and carers.
            </p>
            {canEdit && (
              <Link
                href="/programmes/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
              >
                <Plus className="h-4 w-4" />
                New Programme
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {programmes.map((prog) => {
              const sections = coerceSections(prog.sections);
              const isExpanded = expandedTemplate === prog.id;
              return (
                <div
                  key={prog.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-start gap-2 p-5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTemplate(isExpanded ? null : prog.id)
                      }
                      className="flex flex-1 items-start justify-between gap-4 text-left"
                    >
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {prog.title}
                        </h3>
                        {prog.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {prog.description}
                          </p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {canEdit && (
                      <Link
                        href={`/programmes/${prog.id}/edit`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Edit programme"
                        title="Edit programme"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-5 pb-5 pt-4">
                      {sections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          This programme has no sections yet.
                        </p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {sections.map((block, j) => (
                            <div key={j} className="rounded-xl bg-background p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                {block.title}
                              </p>
                              <ul className="mt-2 space-y-1.5">
                                {block.items.map((item, k) => (
                                  <li
                                    key={k}
                                    className="flex items-start gap-2 text-sm text-foreground/80"
                                  >
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client-Specific Programmes */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Home className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Client Programmes from Reports
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
            {reportsWithProgrammes.length}
          </span>
        </div>
        {reportsWithProgrammes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
            <p className="text-muted-foreground">
              No client programmes yet. Generate a report to create a home
              programme.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reportsWithProgrammes.map((r) => (
              <div
                key={r.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]"
              >
                <button
                  onClick={() =>
                    setExpandedReport(expandedReport === r.id ? null : r.id)
                  }
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {r.client.firstName} {r.client.lastName}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(r.reportDate).toLocaleDateString()} — {r.status}
                    </p>
                  </div>
                  {expandedReport === r.id ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {expandedReport === r.id && (
                  <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Home Programme
                      </p>
                      <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                        {r.content.homeProgrammeSuggestions}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Goals
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-foreground/80">
                        <p>
                          <span className="font-medium">Short-term:</span>{" "}
                          {r.content.goals?.shortTerm}
                        </p>
                        <p>
                          <span className="font-medium">Long-term:</span>{" "}
                          {r.content.goals?.longTerm}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
