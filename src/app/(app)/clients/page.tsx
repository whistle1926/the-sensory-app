"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarPlus,
  Mail,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

interface Stage {
  id: string;
  label: string;
  colour: string;
  order: number;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  diagnosis: string | null;
  parentCarerName: string | null;
  parentCarerEmail: string | null;
  stageId: string | null;
  stage: Stage | null;
  createdAt: string;
}

/**
 * Clients list — admin view.
 *
 * Toolbar + Panel layout, ds-table for the list itself. Stage pills stay
 * above the panel (one pill per stage shows counts at a glance; a Seg
 * doesn't scale past 4-5 options).
 */
export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/settings/client-stages").then((r) => r.json()),
    ]).then(([clientData, stageData]) => {
      setClients(Array.isArray(clientData) ? clientData : []);
      setStages(Array.isArray(stageData) ? stageData : []);
      setLoading(false);
    });
  }, []);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages],
  );

  const filtered = useMemo(() => {
    let list = clients;
    if (stageFilter === "_uncategorised") {
      list = list.filter((c) => !c.stageId);
    } else if (stageFilter !== "all") {
      list = list.filter((c) => c.stageId === stageFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const full = `${c.firstName} ${c.lastName}`.toLowerCase();
        const diag = (c.diagnosis || "").toLowerCase();
        const parent = (c.parentCarerName || "").toLowerCase();
        const email = (c.parentCarerEmail || "").toLowerCase();
        return (
          full.includes(q) ||
          diag.includes(q) ||
          parent.includes(q) ||
          email.includes(q)
        );
      });
    }
    return list.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
      ),
    );
  }, [clients, stageFilter, search]);

  // Derived KPIs — computed once from the already-fetched list.
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);

    const newThisMonth = clients.filter(
      (c) => new Date(c.createdAt) >= monthStart,
    ).length;
    const newLast30 = clients.filter(
      (c) => new Date(c.createdAt) >= last30,
    ).length;
    const withParent = clients.filter((c) => c.parentCarerEmail).length;
    const uncategorised = clients.filter((c) => !c.stageId).length;

    return [
      {
        label: "Active",
        value: String(clients.length),
        helper: `${withParent} with parent email`,
        icon: Users,
        accent: false,
      },
      {
        label: "New · This month",
        value: String(newThisMonth),
        helper: `${newLast30} in last 30d`,
        icon: UserPlus,
        accent: false,
      },
      {
        label: "Linked parents",
        value: String(withParent),
        helper: "Have email on file",
        icon: Mail,
        accent: false,
      },
      {
        label: "Needs stage",
        value: String(uncategorised),
        helper:
          uncategorised === 0
            ? "Everyone's categorised"
            : "Uncategorised",
        icon: CalendarPlus,
        accent: uncategorised > 0,
      },
    ];
  }, [clients]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: clients.length, _uncategorised: 0 };
    for (const s of stages) counts[s.id] = 0;
    for (const c of clients) {
      if (c.stageId && counts[c.stageId] !== undefined) {
        counts[c.stageId]++;
      } else {
        counts._uncategorised++;
      }
    }
    return counts;
  }, [clients, stages]);

  async function moveClient(clientId: string, stageId: string | null) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              stageId,
              stage: stageId
                ? (stages.find((s) => s.id === stageId) ?? null)
                : null,
            }
          : c,
      ),
    );
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
  }

  /** Pill filter: one pill per stage, shows count. Active pill uses primary. */
  const StagePill = ({
    value,
    label,
    dotColour,
    count,
  }: {
    value: string;
    label: string;
    dotColour?: string;
    count: number;
  }) => {
    const isActive = stageFilter === value;
    return (
      <button
        type="button"
        onClick={() => setStageFilter(value)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
          isActive
            ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]"
            : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
        )}
      >
        {dotColour && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: dotColour }}
          />
        )}
        {label}
        <span
          className={cn(
            "rounded-full px-1.5 py-0 text-[11px] font-bold tabular-nums",
            isActive ? "bg-white/25" : "bg-muted",
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <Toolbar
        title="Clients"
        subtitle={
          loading
            ? "Loading…"
            : `${clients.length} ${clients.length === 1 ? "client" : "clients"}`
        }
        actions={
          <Link
            href="/clients/new"
            className={buttonVariants({ className: "rounded-xl" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Link>
        }
      />

      {loading ? (
        <Panel>
          <Empty>Loading clients…</Empty>
        </Panel>
      ) : clients.length === 0 ? (
        <Panel>
          <div className="ds-empty">
            <Users
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No clients yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Add your first client to get started.
            </p>
            <Link
              href="/clients/new"
              className={buttonVariants({ className: "mt-4 rounded-xl" })}
            >
              Add Client
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          {/* KPI row — at-a-glance caseload health */}
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

          {/* Search + stage pill row */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, diagnosis, parent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <StagePill value="all" label="All" count={stageCounts.all} />
              {sortedStages.map((s) => (
                <StagePill
                  key={s.id}
                  value={s.id}
                  label={s.label}
                  dotColour={s.colour}
                  count={stageCounts[s.id] || 0}
                />
              ))}
              {stageCounts._uncategorised > 0 && (
                <StagePill
                  value="_uncategorised"
                  label="Uncategorised"
                  count={stageCounts._uncategorised}
                />
              )}
            </div>
          </div>

          <Panel
            footer={
              <span>
                Showing {filtered.length} of {clients.length}
              </span>
            }
          >
            {filtered.length === 0 ? (
              <div className="ds-empty">
                <Search
                  className="mx-auto h-7 w-7"
                  style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                />
                <p style={{ marginTop: 10, fontWeight: 600 }}>
                  No clients found
                </p>
                <p style={{ marginTop: 4, fontSize: 12 }}>
                  Try adjusting your search or filter.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Diagnosis</th>
                        <th>DOB</th>
                        <th>Parent / Carer</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr
                          key={c.id}
                          onClick={(e) => {
                            // Ignore clicks on the stage dropdown
                            if ((e.target as HTMLElement).closest("select")) return;
                            window.location.href = `/clients/${c.id}`;
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>
                            {c.firstName} {c.lastName}
                          </td>
                          <td style={{ color: "var(--muted-foreground)" }}>
                            {c.diagnosis || "—"}
                          </td>
                          <td
                            className="ds-tabular"
                            style={{
                              color: "var(--muted-foreground)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {new Date(c.dateOfBirth).toLocaleDateString("en-GB")}
                          </td>
                          <td style={{ color: "var(--muted-foreground)" }}>
                            {c.parentCarerName || "—"}
                          </td>
                          <td>
                            <select
                              value={c.stageId ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                moveClient(c.id, e.target.value || null)
                              }
                              className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-primary/50"
                            >
                              <option value="">Uncategorised</option>
                              {sortedStages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-border">
                  {filtered.map((c) => {
                    const stageLabel = c.stage?.label || "Uncategorised";
                    const tone = c.stage ? "primary" : "neutral";
                    return (
                      <Link
                        key={c.id}
                        href={`/clients/${c.id}`}
                        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {c.diagnosis || "No diagnosis"} · DOB{" "}
                            {new Date(c.dateOfBirth).toLocaleDateString("en-GB")}
                          </p>
                        </div>
                        <Chip tone={tone}>{stageLabel}</Chip>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
