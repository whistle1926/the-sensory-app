"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Users } from "lucide-react";
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
  stageId: string | null;
  stage: Stage | null;
}

interface GroupedSection {
  key: string;
  label: string;
  colour: string;
  order: number;
  clients: Client[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const sections = useMemo(() => {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const groups: GroupedSection[] = sorted.map((s) => ({
      key: s.id,
      label: s.label,
      colour: s.colour,
      order: s.order,
      clients: clients.filter((c) => c.stageId === s.id),
    }));

    // Uncategorised clients (no stageId).
    const uncategorised = clients.filter((c) => !c.stageId);
    if (uncategorised.length > 0) {
      groups.push({
        key: "_uncategorised",
        label: "Uncategorised",
        colour: "#9CA3AF",
        order: 999,
        clients: uncategorised,
      });
    }

    return groups;
  }, [clients, stages]);

  function toggleSection(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "client" : "clients"}{" "}
            across {stages.length} {stages.length === 1 ? "stage" : "stages"}
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
            className={buttonVariants({
              className: "mt-4 rounded-xl",
            })}
          >
            Add Client
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => {
            const isOpen = !!expanded[section.key];
            return (
              <div
                key={section.key}
                className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: section.colour }}
                  />
                  <span className="flex-1 text-sm font-semibold">
                    {section.label}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {section.clients.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-5 py-3">
                    {section.clients.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No clients in this stage.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {section.clients.map((c) => (
                          <div
                            key={c.id}
                            className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40"
                          >
                            <Link href={`/clients/${c.id}`}>
                              <p className="font-semibold text-foreground">
                                {c.firstName} {c.lastName}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {c.diagnosis || "No diagnosis listed"}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                DOB:{" "}
                                {new Date(c.dateOfBirth).toLocaleDateString()}
                              </p>
                            </Link>
                            {stages.length > 0 && (
                              <select
                                value={c.stageId ?? ""}
                                onChange={(e) =>
                                  moveClient(
                                    c.id,
                                    e.target.value || null
                                  )
                                }
                                className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] outline-none transition-colors focus:border-primary/50"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">— Uncategorised —</option>
                                {stages
                                  .sort((a, b) => a.order - b.order)
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                              </select>
                            )}
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
  );
}
