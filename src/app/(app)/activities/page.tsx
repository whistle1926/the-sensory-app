"use client";

import { useEffect, useState } from "react";
import { BookOpen, Search, Filter } from "lucide-react";

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

const categoryColours: Record<string, string> = {
  Proprioceptive: "bg-purple-50 text-purple-700 border-purple-200",
  Vestibular: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400",
  Tactile: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400",
  Auditory: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400",
  "Oral Sensory": "bg-rose-50 text-rose-700 border-rose-200",
  Visual: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Self-Regulation": "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activities").then(r => r.json()).then(data => {
      setActivities(Array.isArray(data) ? data : []);
    });
  }, []);

  const categories = ["all", ...Array.from(new Set(activities.map(a => a.category)))];

  const filtered = activities.filter(a => {
    const matchesSearch = search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.targetArea.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped = filtered.reduce<Record<string, Activity[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">{activities.length} sensory activities across {categories.length - 1} categories</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activities, target areas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-10 pr-8 text-sm outline-none focus:border-primary"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
            ))}
          </select>
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{category}</h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">{items.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(a => (
              <div
                key={a.id}
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] card-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{a.name}</h3>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryColours[a.category] || "bg-muted text-muted-foreground border-border"}`}>
                    {a.category}
                  </span>
                </div>

                {expandedId === a.id ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm leading-relaxed text-foreground/80">{a.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {a.targetArea.map(t => (
                        <span key={t} className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {a.ageRange && <span>Ages: {a.ageRange}</span>}
                      {a.equipment.length > 0 && <span>Equipment: {a.equipment.join(", ")}</span>}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
          <p className="text-muted-foreground">No activities match your search.</p>
        </div>
      )}
    </div>
  );
}
