"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  ChevronRight,
  Home,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Toolbar, Panel, Chip, Seg, Empty } from "@/components/ds";

interface Programme {
  id: string;
  title: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; firstName: string; lastName: string } | null;
}

type StatusFilter = "all" | "draft" | "sent";

/**
 * Home Programmes list — standalone, decoupled from reports. Mirrors
 * the Reports list layout (toolbar + segmented filter + compact table)
 * so the two feel like siblings.
 */
export default function HomeProgrammesPage() {
  const [items, setItems] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/home-programmes")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function createBlank() {
    setCreating(true);
    try {
      const res = await fetch("/api/home-programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { id?: string };
      if (data.id) window.location.href = `/home-programmes/${data.id}?edit=1`;
    } finally {
      setCreating(false);
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/home-programmes/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((p) => p.id !== id));
        setConfirmId(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      draft: items.filter((p) => p.status !== "sent").length,
      sent: items.filter((p) => p.status === "sent").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "sent") return items.filter((p) => p.status === "sent");
    return items.filter((p) => p.status !== "sent");
  }, [items, filter]);

  return (
    <div className="space-y-6">
      <Toolbar
        title="Home Programmes"
        subtitle={
          loading
            ? "Loading…"
            : `${counts.all} total · ${counts.draft} draft · ${counts.sent} sent`
        }
        actions={
          <button
            type="button"
            onClick={createBlank}
            disabled={creating}
            className={buttonVariants({ className: "rounded-xl" })}
          >
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Home Programme
          </button>
        }
      />

      <Panel
        actions={
          <Seg
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All · ${counts.all}` },
              { value: "draft", label: `Draft · ${counts.draft}` },
              { value: "sent", label: `Sent · ${counts.sent}` },
            ]}
          />
        }
        footer={
          <span>
            Showing {filtered.length} of {items.length}
          </span>
        }
      >
        {loading ? (
          <Empty>Loading home programmes…</Empty>
        ) : filtered.length === 0 ? (
          <div className="ds-empty">
            <Home
              className="mx-auto h-7 w-7"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              No home programmes yet
            </p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Create one to send activities home without writing a full report.
            </p>
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>For</th>
                <th>Updated</th>
                <th>Status</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const sent = p.status === "sent";
                const isConfirming = confirmId === p.id;
                const isDeleting = deletingId === p.id;

                if (isConfirming) {
                  return (
                    <tr key={p.id} style={{ background: "rgba(239,68,68,0.04)" }}>
                      <td colSpan={5}>
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
                          <span className="text-sm">
                            Delete <strong>{p.title}</strong>
                            {p.client
                              ? ` for ${p.client.firstName} ${p.client.lastName}`
                              : ""}
                            ?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(p.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Deleting…
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-3 w-3" />
                                  Confirm delete
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={p.id}
                    onClick={() => {
                      window.location.href = `/home-programmes/${p.id}`;
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>{p.title}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>
                      {p.client
                        ? `${p.client.firstName} ${p.client.lastName}`
                        : "—"}
                    </td>
                    <td
                      className="ds-tabular"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {new Date(p.updatedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      {sent ? (
                        <Chip tone="success">
                          <Send className="mr-1 inline h-3 w-3" />
                          Sent
                        </Chip>
                      ) : (
                        <Chip tone="warn">Draft</Chip>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmId(p.id);
                          }}
                          title="Delete home programme"
                          aria-label="Delete home programme"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
