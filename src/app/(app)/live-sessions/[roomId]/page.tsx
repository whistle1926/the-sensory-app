"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Radio,
  Square,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar, Panel, Chip } from "@/components/ds";

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
    </div>
  );
}
