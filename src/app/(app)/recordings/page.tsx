"use client";

/**
 * Recordings — Zoom cloud recordings synced to Vimeo, ready to publish as
 * course content.
 *
 * A Zoom recording finishing fires our webhook, which asks Vimeo to pull the
 * file across. This page shows each recording's progress and lets an admin
 * publish a finished one onto a course lesson or a live-session replay. The
 * course player already renders Vimeo links, so publishing makes it instantly
 * watchable in the client portal.
 */
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Recording {
  id: string;
  topic: string;
  startedAt: string;
  durationMin: number;
  sizeMb: number | null;
  vimeoLink: string | null;
  status: string;
  error: string | null;
  publishedModuleId: string | null;
  publishedLiveRoomId: string | null;
  publishedAt: string | null;
}
interface CourseOpt {
  id: string;
  title: string;
  modules: { id: string; title: string; order: number; videoUrl: string | null }[];
}
interface LiveRoomOpt {
  id: string;
  title: string;
  scheduledStart: string;
  mediaUrl: string | null;
}
interface Payload {
  configured: { zoom: boolean; vimeo: boolean };
  recordings: Recording[];
  courses: CourseOpt[];
  liveRooms: LiveRoomOpt[];
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Queued", cls: "bg-muted text-muted-foreground" },
  uploading: {
    label: "Uploading to Vimeo",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  transcoding: {
    label: "Processing",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  ready: {
    label: "Ready",
    cls: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  },
  failed: {
    label: "Failed",
    cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
};

export default function RecordingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [publishFor, setPublishFor] = useState<Recording | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/recordings");
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While anything is uploading/processing, poll so the status advances
  // without the user having to refresh.
  useEffect(() => {
    const busy = data?.recordings.some((r) =>
      ["pending", "uploading", "transcoding"].includes(r.status),
    );
    if (!busy) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [data, load]);

  async function retry(r: Recording) {
    setRetryingId(r.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/recordings/${r.id}/retry`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg(
        res.ok
          ? `Retrying “${r.topic}” — it's uploading to Vimeo again.`
          : (j.error ?? "Retry failed."),
      );
      await load();
    } catch {
      setMsg("Retry failed.");
    } finally {
      setRetryingId(null);
    }
  }

  async function runImport() {
    setImporting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/recordings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 60 }),
      });
      const j = await r.json();
      setMsg(
        r.ok
          ? `Checked ${j.found ?? 0} Zoom recording${j.found === 1 ? "" : "s"} — ${j.imported ?? 0} new one${j.imported === 1 ? "" : "s"} started uploading.`
          : (j.error ?? "Import failed"),
      );
      await load();
    } catch {
      setMsg("Import failed");
    } finally {
      setImporting(false);
    }
  }

  const notConfigured = data && (!data.configured.zoom || !data.configured.vimeo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Zoom recordings are pulled into Vimeo automatically, then you
            publish them to a course lesson or a live-session replay.
          </p>
        </div>
        <Button onClick={runImport} disabled={importing || !data?.configured.zoom}>
          {importing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Import from Zoom
        </Button>
      </div>

      {notConfigured && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {!data?.configured.zoom && !data?.configured.vimeo
              ? "Zoom and Vimeo aren't connected yet."
              : !data?.configured.zoom
                ? "Zoom isn't connected yet."
                : "Vimeo isn't connected yet."}{" "}
            The credentials still need adding — ask Paddy.
          </span>
        </div>
      )}

      {msg && (
        <div className="rounded-xl bg-muted/60 p-3 text-sm">{msg}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading recordings…
          </div>
        ) : !data || data.recordings.length === 0 ? (
          <div className="p-10 text-center">
            <Video className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No recordings yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record a Zoom meeting to the cloud and it&apos;ll appear here
              automatically — or use “Import from Zoom” to bring across
              existing ones.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Recording</th>
                  <th className="px-4 py-3 font-medium">Recorded</th>
                  <th className="px-4 py-3 font-medium">Length</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Published</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recordings.map((r) => {
                  const st = STATUS[r.status] ?? STATUS.pending;
                  const published = r.publishedModuleId || r.publishedLiveRoomId;
                  return (
                    <tr key={r.id} className="align-top transition hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.topic}</div>
                        {r.vimeoLink && (
                          <a
                            href={r.vimeoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            View on Vimeo <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.error && (
                          <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                            {r.error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.startedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.durationMin ? `${r.durationMin} min` : "—"}
                        {r.sizeMb ? ` · ${r.sizeMb} MB` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            st.cls,
                          )}
                        >
                          {["pending", "uploading", "transcoding"].includes(r.status) && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {published ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {r.publishedModuleId ? "Course lesson" : "Live replay"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* A failed sync can't be picked up again by the
                            webhook/import (idempotent on meeting UUID), so it
                            gets an explicit Retry instead. */}
                        {r.status === "failed" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={retryingId === r.id}
                            onClick={() => retry(r)}
                          >
                            {retryingId === r.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Retry
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={r.status !== "ready"}
                            onClick={() => setPublishFor(r)}
                          >
                            {published ? "Re-publish" : "Publish"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {publishFor && data && (
        <PublishDialog
          recording={publishFor}
          courses={data.courses}
          liveRooms={data.liveRooms}
          onClose={() => setPublishFor(null)}
          onDone={async (m) => {
            setPublishFor(null);
            setMsg(m);
            await load();
          }}
        />
      )}
    </div>
  );
}

function PublishDialog({
  recording,
  courses,
  liveRooms,
  onClose,
  onDone,
}: {
  recording: Recording;
  courses: CourseOpt[];
  liveRooms: LiveRoomOpt[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [target, setTarget] = useState<"module" | "liveRoom">("module");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(""); // "" = create a new lesson
  const [newTitle, setNewTitle] = useState(recording.topic);
  const [liveRoomId, setLiveRoomId] = useState(liveRooms[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const course = courses.find((c) => c.id === courseId);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const body =
        target === "liveRoom"
          ? { target, liveRoomId }
          : { target, courseId, moduleId: moduleId || undefined, newTitle };
      const r = await fetch(`/api/recordings/${recording.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Publish failed");
      onDone(
        target === "liveRoom"
          ? "Published as the live-session replay."
          : moduleId
            ? "Video added to that lesson."
            : "New lesson created with the video.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Publish recording</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{recording.topic}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTarget("module")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition-colors",
                target === "module"
                  ? "border-primary bg-primary/5 font-semibold"
                  : "border-border hover:bg-muted",
              )}
            >
              Course lesson
            </button>
            <button
              type="button"
              onClick={() => setTarget("liveRoom")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition-colors",
                target === "liveRoom"
                  ? "border-primary bg-primary/5 font-semibold"
                  : "border-border hover:bg-muted",
              )}
            >
              Live session replay
            </button>
          </div>

          {target === "module" ? (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Course
                </label>
                <select
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setModuleId("");
                  }}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {courses.length === 0 && <option value="">No courses yet</option>}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lesson
                </label>
                <select
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">➕ Create a new lesson</option>
                  {(course?.modules ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.order + 1}. {m.title}
                      {m.videoUrl ? " (has a video — will be replaced)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {!moduleId && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    New lesson title
                  </label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live session
              </label>
              <select
                value={liveRoomId}
                onChange={(e) => setLiveRoomId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {liveRooms.length === 0 && <option value="">No live sessions yet</option>}
                {liveRooms.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} ·{" "}
                    {new Date(l.scheduledStart).toLocaleDateString("en-GB")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {err}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                saving ||
                (target === "module" ? !courseId : !liveRoomId)
              }
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
