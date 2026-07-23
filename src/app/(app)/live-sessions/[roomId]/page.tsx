"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Link2,
  Loader2,
  Paperclip,
  Radio,
  Square,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { upload as blobUpload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Toolbar, Panel, Chip } from "@/components/ds";

interface Resource {
  id: string;
  title: string;
  url: string;
  kind: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface Room {
  id: string;
  title: string;
  description: string;
  mode: "broadcast" | "interactive";
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduledStart: string;
  actualStart: string | null;
  actualEnd: string | null;
  requireAuth: boolean;
  posterUrl: string | null;
  resources: Resource[];
  host: { id: string; name: string } | null;
}

/**
 * Admin session-detail page. Shows the session's info, a big Go Live / End
 * control, and the public share link so you can DM it to attendees.
 */
export default function LiveSessionDetailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Cover image + resources
  const [posterBusy, setPosterBusy] = useState(false);
  const [resBusy, setResBusy] = useState(false);
  const [resErr, setResErr] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const posterInputRef = useRef<HTMLInputElement>(null);
  const resFileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/livekit/public/rooms/${roomId}`);
    if (res.ok) {
      setRoom(await res.json());
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(status: Room["status"]) {
    setBusy(true);
    const res = await fetch(`/api/livekit/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await load();
      if (status === "live") {
        router.push(`/live-sessions/${roomId}/host`);
      }
    }
    setBusy(false);
  }

  /**
   * Upload straight from the browser to Blob storage. Not posted through an
   * API route because Vercel caps request bodies at ~4.5 MB, which silently
   * killed PDF/PowerPoint uploads at the edge — the handler never ran, so the
   * UI just hung. Direct upload has no such limit.
   */
  async function uploadFile(
    file: File,
  ): Promise<{ url: string; mimeType: string; sizeBytes: number }> {
    const blob = await blobUpload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/uploads/blob",
    });
    return { url: blob.url, mimeType: file.type, sizeBytes: file.size };
  }

  async function setPoster(url: string | null) {
    await fetch(`/api/livekit/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posterUrl: url ?? "" }),
    });
    await load();
  }

  async function onPosterPicked(file: File) {
    setPosterBusy(true);
    setResErr(null);
    try {
      const { url } = await uploadFile(file);
      await setPoster(url);
    } catch (e) {
      setResErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPosterBusy(false);
      if (posterInputRef.current) posterInputRef.current.value = "";
    }
  }

  async function addResource(payload: {
    title: string;
    url: string;
    kind: "file" | "link";
    mimeType?: string;
    sizeBytes?: number;
  }) {
    const res = await fetch(`/api/livekit/rooms/${roomId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Couldn't add that");
    await load();
  }

  async function onResourceFilePicked(file: File) {
    setResBusy(true);
    setResErr(null);
    try {
      const { url, mimeType, sizeBytes } = await uploadFile(file);
      await addResource({ title: file.name, url, kind: "file", mimeType, sizeBytes });
    } catch (e) {
      setResErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setResBusy(false);
      if (resFileInputRef.current) resFileInputRef.current.value = "";
    }
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    setResBusy(true);
    setResErr(null);
    try {
      await addResource({
        title: linkTitle.trim() || linkUrl.trim(),
        url: linkUrl.trim(),
        kind: "link",
      });
      setLinkTitle("");
      setLinkUrl("");
    } catch (e) {
      setResErr(e instanceof Error ? e.message : "Couldn't add that link");
    } finally {
      setResBusy(false);
    }
  }

  async function removeResource(id: string) {
    setResBusy(true);
    try {
      await fetch(`/api/livekit/rooms/${roomId}/resources/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setResBusy(false);
    }
  }

  if (loading || !room) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/live/${room.id}`
      : `/live/${room.id}`;

  const statusTone =
    room.status === "live"
      ? "success"
      : room.status === "scheduled"
        ? "primary"
        : room.status === "cancelled"
          ? "warn"
          : "neutral";

  return (
    <div className="space-y-6">
      <Link
        href="/live-sessions"
        className="ds-link inline-flex items-center"
        style={{ fontWeight: 500 }}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Back to Live Sessions
      </Link>

      <Toolbar
        title={room.title}
        subtitle={room.description || "Live session"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={statusTone}>
              {room.status[0].toUpperCase() + room.status.slice(1)}
            </Chip>
            <Chip tone={room.mode === "interactive" ? "info" : "primary"}>
              {room.mode === "interactive" ? "Interactive" : "Broadcast"}
            </Chip>
          </div>
        }
      />

      {/* Primary controls */}
      <Panel padded>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Host controls
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {room.status === "scheduled" &&
                "Click Go Live to open the host studio and start broadcasting."}
              {room.status === "live" &&
                "You're live. Click End to close the room."}
              {room.status === "ended" &&
                "This session has ended. Recordings (if any) will show below."}
              {room.status === "cancelled" &&
                "This session was cancelled."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {room.status === "scheduled" && (
              <Button
                type="button"
                onClick={() => setStatus("live")}
                disabled={busy}
                className="rounded-xl"
              >
                <Radio className="mr-2 h-4 w-4" />
                Go Live
              </Button>
            )}
            {room.status === "live" && (
              <>
                <Link
                  href={`/live-sessions/${room.id}/host`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  <Video className="h-4 w-4" />
                  Open host studio
                </Link>
                <Button
                  type="button"
                  onClick={() => setStatus("ended")}
                  disabled={busy}
                  variant="outline"
                  className="rounded-xl text-red-600 hover:bg-red-50"
                >
                  <Square className="mr-2 h-4 w-4" />
                  End session
                </Button>
              </>
            )}
          </div>
        </div>
      </Panel>

      {/* Share link */}
      <Panel
        title="Public viewer link"
        subtitle={
          room.requireAuth
            ? "Only signed-in users can join"
            : "Anyone with this link can join"
        }
        padded
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            {publicUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                window.prompt("Copy this link:", publicUrl);
              }
            }}
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-green-600" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </a>
        </div>
      </Panel>

      {/* Meta */}
      <Panel title="Session info" padded>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scheduled start
            </dt>
            <dd className="mt-1">
              {new Date(room.scheduledStart).toLocaleString("en-GB")}
            </dd>
          </div>
          {room.actualStart && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Went live
              </dt>
              <dd className="mt-1">
                {new Date(room.actualStart).toLocaleString("en-GB")}
              </dd>
            </div>
          )}
          {room.actualEnd && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ended
              </dt>
              <dd className="mt-1">
                {new Date(room.actualEnd).toLocaleString("en-GB")}
              </dd>
            </div>
          )}
          {room.host && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Host
              </dt>
              <dd className="mt-1 inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {room.host.name}
              </dd>
            </div>
          )}
        </dl>
      </Panel>

      {/* Cover image — what attendees see on the join page before it starts. */}
      <Panel title="Cover image" padded>
        <p className="mb-3 text-xs text-muted-foreground">
          Shown on the join page before the session starts. Use{" "}
          <strong>1920 × 1080 pixels</strong> (16:9 widescreen) — a square image
          will be cropped. JPG or PNG.
        </p>
        <input
          ref={posterInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPosterPicked(f);
          }}
        />
        {room.posterUrl ? (
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={room.posterUrl}
              alt="Session cover"
              className="h-24 w-44 rounded-lg border border-border object-cover"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => posterInputRef.current?.click()}
                disabled={posterBusy}
                className="text-left text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Change image
              </button>
              <button
                type="button"
                onClick={() => setPoster(null)}
                disabled={posterBusy}
                className="text-left text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => posterInputRef.current?.click()}
            disabled={posterBusy}
          >
            {posterBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            Upload cover image
          </Button>
        )}
      </Panel>

      {/* Resources — handouts and links attendees can grab from the session. */}
      <Panel title="Resources" padded>
        <p className="mb-3 text-xs text-muted-foreground">
          Handouts, slides or links attendees can download from the session
          page — so you don&apos;t have to email them round separately.
        </p>

        {room.resources.length > 0 && (
          <ul className="mb-4 space-y-2">
            {room.resources.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-sm hover:underline"
                >
                  {r.kind === "link" ? (
                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{r.title}</span>
                  {r.sizeBytes ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {Math.max(1, Math.round(r.sizeBytes / 1024))} KB
                    </span>
                  ) : null}
                </a>
                <button
                  type="button"
                  onClick={() => removeResource(r.id)}
                  disabled={resBusy}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                  aria-label={`Remove ${r.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={resFileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onResourceFilePicked(f);
          }}
        />

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => resFileInputRef.current?.click()}
            disabled={resBusy}
          >
            {resBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="mr-2 h-4 w-4" />
            )}
            Upload a file
          </Button>

          <div className="rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              …or add a link
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Label (optional)"
                className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="min-w-[200px] flex-[2] rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <Button onClick={addLink} disabled={resBusy || !linkUrl.trim()}>
                Add link
              </Button>
            </div>
          </div>
        </div>

        {resErr && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {resErr}
          </p>
        )}
      </Panel>
    </div>
  );
}
