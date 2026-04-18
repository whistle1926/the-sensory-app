"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Filter, Search } from "lucide-react";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  targetArea: string[];
  ageRange: string | null;
  equipment: string[];
  business: string;
}

/** Each sensory category gets a distinct chip tone. */
const CATEGORY_TONE: Record<string, "primary" | "info" | "success" | "warn" | "danger" | "neutral"> = {
  Proprioceptive: "primary",
  Vestibular: "info",
  Tactile: "warn",
  Auditory: "success",
  "Oral Sensory": "danger",
  Visual: "info",
  "Self-Regulation": "primary",
};

/**
 * Activity Bank — admin view.
 *
 * Toolbar + search/filter bar + one Panel per sensory category. Cards
 * inside each panel expand to show description, target areas, and
 * equipment.
 */
export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data) => {
        setActivities(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(activities.map((a) => a.category)))],
    [activities],
  );

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const matchesSearch =
        search === "" ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        a.targetArea.some((t) =>
          t.toLowerCase().includes(search.toLowerCase()),
        );
      const matchesCategory =
        selectedCategory === "all" || a.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activities, search, selectedCategory]);

  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, Activity[]>>((acc, a) => {
        (acc[a.category] = acc[a.category] || []).push(a);
        return acc;
      }, {}),
    [filtered],
  );

  return (
    <div className="space-y-6">
      <Toolbar
        title="Activity Bank"
        subtitle={
          loading
            ? "Loading…"
            : `${activities.length} sensory activities across ${categories.length - 1} categories`
        }
      />

      {/* Search + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activities, target areas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-10 pr-8 text-sm outline-none focus:border-primary"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Panel>
          <Empty>Loading activities…</Empty>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <Empty>No activities match your search.</Empty>
        </Panel>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Panel
            key={category}
            title={
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {category}
              </span>
            }
            actions={
              <Chip tone="primary" dot={false}>
                {items.length}
              </Chip>
            }
            padded
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <div
                  key={a.id}
                  onClick={() =>
                    setExpandedId(expandedId === a.id ? null : a.id)
                  }
                  className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] card-lift"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{a.name}</h3>
                    <Chip tone={CATEGORY_TONE[a.category] || "neutral"}>
                      {a.category}
                    </Chip>
                  </div>

                  {expandedId === a.id ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm leading-relaxed text-foreground/80">
                        {a.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {a.targetArea.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {a.ageRange && <span>Ages: {a.ageRange}</span>}
                        {a.equipment.length > 0 && (
                          <span>Equipment: {a.equipment.join(", ")}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {a.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
