"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Home,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Play,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sanitiseProgrammeSections,
  type ProgrammeSection,
  type ProgrammeItem,
} from "@/lib/programme-sections";
import { DemoViewer } from "@/components/programmes/demo-viewer";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

interface ProgrammeTemplate {
  id: string;
  title: string;
  description: string;
  sections: unknown; // Json — coerced at render time
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

/**
 * Programmes — admin view. Two sections: reusable Templates + Client-specific
 * programmes generated from reports. Each section is a Panel; the rows
 * stay expandable so the content preview is one click away.
 */
export default function ProgrammesPage() {
  const { data: session } = useSession();
  const canEdit = session?.user?.role !== "CLIENT";

  const [programmes, setProgrammes] = useState<ProgrammeTemplate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDemo, setActiveDemo] = useState<ProgrammeItem | null>(null);
  /** Filter the templates list. Matches title / description / any
   * section heading or item text so a search for "bedtime" surfaces
   * Sleep Support even though it's deep in the structure. */
  const [search, setSearch] = useState("");

  const filteredProgrammes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return programmes;
    return programmes.filter((p) => {
      if (p.title.toLowerCase().includes(q)) return true;
      if (p.description.toLowerCase().includes(q)) return true;
      // Search section titles + item text — cheap because the list is
      // small (a few dozen programmes at most).
      const sections = sanitiseProgrammeSections(p.sections);
      return sections.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.items.some((i) => i.text.toLowerCase().includes(q)),
      );
    });
  }, [programmes, search]);

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
    <div className="space-y-6">
      <Toolbar
        title="Home Programmes"
        subtitle="Structured home programmes and templates for parents and carers"
        actions={
          canEdit && (
            <Link href="/programmes/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Programme
              </Button>
            </Link>
          )
        }
      />

      {/* Programme Templates */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Programme Templates
          </span>
        }
        subtitle="Reusable blueprints you can share with any client"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search programmes…"
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Chip tone="primary" dot={false}>
              {search ? `${filteredProgrammes.length}/${programmes.length}` : programmes.length}
            </Chip>
          </div>
        }
      >
        {loading ? (
          <Empty>Loading programmes…</Empty>
        ) : programmes.length === 0 ? (
          <div className="ds-empty">
            <ClipboardList
              className="mx-auto h-7 w-7"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              No programme templates yet
            </p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Create your first template to share with parents and carers.
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
        ) : filteredProgrammes.length === 0 ? (
          <div className="ds-empty">
            <Search
              className="mx-auto h-7 w-7"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              No programmes match &ldquo;{search}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-3 text-xs text-primary underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredProgrammes.map((prog) => {
              const sections: ProgrammeSection[] = sanitiseProgrammeSections(
                prog.sections,
              );
              const isExpanded = expandedTemplate === prog.id;
              return (
                <div key={prog.id}>
                  <div className="flex items-start gap-2 px-5 py-4">
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
                    <div className="bg-muted/20 px-5 pb-5 pt-4">
                      {sections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          This programme has no sections yet.
                        </p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {sections.map((block, j) => (
                            <div
                              key={j}
                              className="rounded-xl border border-border bg-card p-4"
                            >
                              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                {block.title}
                              </p>
                              <ul className="mt-2 space-y-1.5">
                                {block.items.map((item, k) => (
                                  <li
                                    key={k}
                                    className="flex items-start gap-2 text-sm text-foreground/80"
                                  >
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                    <span className="flex-1">{item.text}</span>
                                    {item.demoSteps &&
                                      item.demoSteps.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveDemo(item)}
                                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                                          title="Watch demo"
                                        >
                                          <Play className="h-3 w-3" />
                                          Demo
                                        </button>
                                      )}
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
      </Panel>

      {/* Client-Specific Programmes from Reports */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            Client Programmes from Reports
          </span>
        }
        subtitle="Auto-generated from recent reports"
        actions={
          <Chip tone="primary" dot={false}>
            {reportsWithProgrammes.length}
          </Chip>
        }
      >
        {reportsWithProgrammes.length === 0 ? (
          <Empty>
            No client programmes yet. Generate a report to create a home
            programme.
          </Empty>
        ) : (
          <div className="divide-y divide-border">
            {reportsWithProgrammes.map((r) => (
              <div key={r.id}>
                <button
                  onClick={() =>
                    setExpandedReport(expandedReport === r.id ? null : r.id)
                  }
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/20"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {r.client.firstName} {r.client.lastName}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(r.reportDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      — {r.status}
                    </p>
                  </div>
                  {expandedReport === r.id ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {expandedReport === r.id && (
                  <div className="space-y-4 bg-muted/20 px-5 pb-5 pt-4">
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
      </Panel>

      <DemoViewer
        open={activeDemo !== null}
        onClose={() => setActiveDemo(null)}
        exerciseTitle={activeDemo?.text ?? ""}
        steps={activeDemo?.demoSteps ?? []}
      />
    </div>
  );
}
