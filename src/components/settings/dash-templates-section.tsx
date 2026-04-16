"use client";

import { useEffect, useState } from "react";
import {
  Check,
  LayoutDashboard,
  Loader2,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Widget definitions                                                 */
/* ------------------------------------------------------------------ */

const AVAILABLE_WIDGETS = [
  {
    key: "stat_active_clients",
    label: "Active Clients Count",
    description: "Shows the total number of active clients",
  },
  {
    key: "stat_total_reports",
    label: "Total Reports Count",
    description: "Shows the total number of reports generated",
  },
  {
    key: "new_clients",
    label: "New Clients & Intake",
    description: "Shows clients awaiting assessment with intake item tracking",
  },
  {
    key: "recent_reports",
    label: "Recent Reports",
    description: "Shows the 5 most recent reports",
  },
] as const;

type WidgetKey = (typeof AVAILABLE_WIDGETS)[number]["key"];

const ALL_WIDGET_KEYS: string[] = AVAILABLE_WIDGETS.map((w) => w.key);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashTemplate {
  id: string;
  name: string;
  widgets: string[];
  isDefault: boolean;
  _userCount: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DashTemplatesSection() {
  const [templates, setTemplates] = useState<DashTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWidgets, setNewWidgets] = useState<string[]>([...ALL_WIDGET_KEYS]);
  const [saving, setSaving] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  /* ---- data fetching ---- */

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/dash-templates");
      if (res.ok) setTemplates(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* ---- create ---- */

  function openCreate() {
    setNewName("");
    setNewWidgets([...ALL_WIDGET_KEYS]);
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/settings/dash-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), widgets: newWidgets }),
      });
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  /* ---- widget toggle (inline patch) ---- */

  async function toggleWidget(template: DashTemplate, widgetKey: string) {
    const next = template.widgets.includes(widgetKey)
      ? template.widgets.filter((k) => k !== widgetKey)
      : [...template.widgets, widgetKey];

    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, widgets: next } : t))
    );
    setPatchingId(template.id);
    try {
      await fetch(`/api/settings/dash-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: next }),
      });
    } finally {
      setPatchingId(null);
    }
  }

  /* ---- set default ---- */

  async function handleSetDefault(id: string) {
    setPatchingId(id);
    try {
      await fetch(`/api/settings/dash-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      load();
    } finally {
      setPatchingId(null);
    }
  }

  /* ---- delete ---- */

  async function handleDelete(template: DashTemplate) {
    const isOnlyDefault =
      template.isDefault &&
      templates.filter((t) => t.isDefault).length <= 1;
    if (isOnlyDefault) return;

    if (
      !confirm(
        `Delete "${template.name}"? ${
          template._userCount > 0
            ? `${template._userCount} user(s) will lose this template assignment.`
            : ""
        }`
      )
    )
      return;

    await fetch(`/api/settings/dash-templates/${template.id}`, {
      method: "DELETE",
    });
    load();
  }

  /* ---- dialog widget toggle ---- */

  function toggleNewWidget(key: string) {
    setNewWidgets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Dashboard Templates</h2>
            <p className="text-sm text-muted-foreground">
              Control which sections each team member sees on their dashboard
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
        >
          <Plus className="h-3.5 w-3.5" /> Create Template
        </button>
      </div>

      {/* Template list */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">No templates yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Create your first template to control what team members see on
                their dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
            >
              <Plus className="h-3.5 w-3.5" /> Create First Template
            </button>
          </div>
        ) : (
          templates.map((tmpl) => {
            const isOnlyDefault =
              tmpl.isDefault &&
              templates.filter((t) => t.isDefault).length <= 1;

            return (
              <div
                key={tmpl.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                {/* Template header row */}
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium">
                    {tmpl.name}
                  </span>

                  {tmpl.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Star className="h-2.5 w-2.5" /> Default
                    </span>
                  )}

                  {tmpl._userCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {tmpl._userCount} user{tmpl._userCount !== 1 ? "s" : ""}
                    </span>
                  )}

                  <div className="flex items-center gap-0.5">
                    {!tmpl.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(tmpl.id)}
                        disabled={patchingId === tmpl.id}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                        title="Set as default template"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(tmpl)}
                      disabled={isOnlyDefault}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      title={
                        isOnlyDefault
                          ? "Cannot delete the only default template"
                          : "Delete template"
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Widget checkboxes */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {AVAILABLE_WIDGETS.map((w) => {
                    const active = tmpl.widgets.includes(w.key);
                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => toggleWidget(tmpl, w.key)}
                        disabled={patchingId === tmpl.id}
                        className={cn(
                          "group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                          active
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-background hover:border-border hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-muted-foreground/40 bg-background"
                          )}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium leading-tight">
                            {w.label}
                          </span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {w.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        The default template (star) is automatically applied to new team
        members. Toggle widgets to control what each template shows.
      </p>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Template Name *
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="e.g. Therapist View"
                autoFocus
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Widget selection */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Visible Widgets
              </label>
              <div className="space-y-2">
                {AVAILABLE_WIDGETS.map((w) => {
                  const active = newWidgets.includes(w.key);
                  return (
                    <button
                      key={w.key}
                      type="button"
                      onClick={() => toggleNewWidget(w.key)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                        active
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-background hover:border-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-muted-foreground/40 bg-background"
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium leading-tight">
                          {w.label}
                        </span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {w.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create Template
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
