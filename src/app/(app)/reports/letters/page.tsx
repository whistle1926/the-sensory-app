"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Toolbar, Panel, Seg, Empty } from "@/components/ds";

interface LetterRow {
  id: string;
  title: string;
  recipient: string;
  status: string;
  sentAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  client: { firstName: string; lastName: string } | null;
}

type StatusFilter = "all" | "draft" | "sent";

/**
 * Letters list — the second tab of the Reports section. Freeform letters
 * (school summaries, statutory-assessment support, etc.), separate from
 * session-bound reports.
 */
export default function LettersPage() {
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/letters")
      .then((r) => r.json())
      .then((data) => setLetters(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function deleteLetter(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/letters/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      setLetters((prev) => prev.filter((l) => l.id !== id));
      setConfirmId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const counts = useMemo(
    () => ({
      all: letters.length,
      draft: letters.filter((l) => (l.status || "") !== "sent").length,
      sent: letters.filter((l) => (l.status || "") === "sent").length,
    }),
    [letters],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return letters;
    if (filter === "sent")
      return letters.filter((l) => l.status === "sent");
    return letters.filter((l) => l.status !== "sent");
  }, [letters, filter]);

  return (
    <div className="space-y-6">
      <Toolbar
        title="Letters"
        subtitle={
          loading
            ? "Loading…"
            : `${counts.all} total · ${counts.draft} drafting · ${counts.sent} sent`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className={buttonVariants({
                variant: "outline",
                className: "rounded-xl",
              })}
            >
              Reports
            </Link>
            <Link
              href="/reports/letters/new"
              className={buttonVariants({ className: "rounded-xl" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              New letter
            </Link>
          </div>
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
            Showing {filtered.length} of {letters.length}
          </span>
        }
      >
        {loading ? (
          <Empty>Loading letters…</Empty>
        ) : filtered.length === 0 ? (
          <div className="ds-empty">
            <Mail
              className="mx-auto h-7 w-7"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No letters yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Write a school summary or a statutory-assessment letter — it&apos;s
              kept here with the practice letterhead.
            </p>
            <Link
              href="/reports/letters/new"
              className={buttonVariants({ className: "mt-4 rounded-xl" })}
            >
              <Plus className="mr-2 h-4 w-4" /> New letter
            </Link>
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Re</th>
                <th>Status</th>
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link
                      href={`/reports/letters/${l.id}`}
                      className="inline-flex items-center gap-2 font-medium hover:text-primary"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {l.title || "Untitled letter"}
                    </Link>
                  </td>
                  <td className="text-muted-foreground">
                    {l.client
                      ? `${l.client.firstName} ${l.client.lastName}`
                      : "—"}
                  </td>
                  <td>
                    {l.status === "sent" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                        <Send className="h-3 w-3" /> Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        Draft
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {confirmId === l.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => deleteLetter(l.id)}
                            disabled={deletingId === l.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            {deletingId === l.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                            aria-label="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmId(l.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"
                            aria-label="Delete letter"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            href={`/reports/letters/${l.id}`}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Open letter"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {deleteError && (
        <p className="text-sm text-red-600">{deleteError}</p>
      )}
    </div>
  );
}
