"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    [stages]
  );

  const filtered = useMemo(() => {
    let list = clients;

    // Stage filter
    if (stageFilter === "_uncategorised") {
      list = list.filter((c) => !c.stageId);
    } else if (stageFilter !== "all") {
      list = list.filter((c) => c.stageId === stageFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const full = `${c.firstName} ${c.lastName}`.toLowerCase();
        const diag = (c.diagnosis || "").toLowerCase();
        const parent = (c.parentCarerName || "").toLowerCase();
        const email = (c.parentCarerEmail || "").toLowerCase();
        return full.includes(q) || diag.includes(q) || parent.includes(q) || email.includes(q);
      });
    }

    // Sort alphabetically
    return list.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [clients, stageFilter, search]);

  // Stage counts for filter pills
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
                ? stages.find((s) => s.id === stageId) ?? null
                : null,
            }
          : c
      )
    );
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "client" : "clients"}
          </p>
        </div>
        <Link
          href="/clients/new"
          className={buttonVariants({ className: "rounded-xl" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm)]">
          Loading clients…
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-semibold">No clients yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first client to get started.
          </p>
          <Link
            href="/clients/new"
            className={buttonVariants({ className: "mt-4 rounded-xl" })}
          >
            Add Client
          </Link>
        </div>
      ) : (
        <>
          {/* Search + Filters */}
          <div className="space-y-3">
            {/* Search bar */}
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

            {/* Stage filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStageFilter("all")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  stageFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                All
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  stageFilter === "all" ? "bg-white/20" : "bg-background"
                )}>
                  {stageCounts.all}
                </span>
              </button>
              {sortedStages.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStageFilter(s.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    stageFilter === s.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.colour }}
                  />
                  {s.label}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    stageFilter === s.id ? "bg-white/20" : "bg-background"
                  )}>
                    {stageCounts[s.id] || 0}
                  </span>
                </button>
              ))}
              {stageCounts._uncategorised > 0 && (
                <button
                  type="button"
                  onClick={() => setStageFilter("_uncategorised")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    stageFilter === "_uncategorised"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Uncategorised
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    stageFilter === "_uncategorised" ? "bg-white/20" : "bg-background"
                  )}>
                    {stageCounts._uncategorised}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Client list */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold">No clients found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your search or filter.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Diagnosis
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        DOB
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Parent / Carer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Stage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/clients/${c.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors"
                          >
                            {c.firstName} {c.lastName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.diagnosis || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(c.dateOfBirth).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.parentCarerName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={c.stageId ?? ""}
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
                  const stageColour = c.stage?.colour || "#9CA3AF";
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
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${stageColour}18`,
                          color: stageColour,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: stageColour }}
                        />
                        {stageLabel}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {clients.length} clients
          </p>
        </>
      )}
    </div>
  );
}
