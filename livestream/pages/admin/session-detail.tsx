"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  LiveRoom,
  LiveRoomStatus,
  LiveRecording,
  LiveRecordingStatus,
} from "@/lib/database.types";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Play,
  Square,
  XCircle,
  Copy,
  Video,
  Circle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// NOTE: Replace `/host/live/` below with wherever you mount the host studio
// page (`pages/host/studio.tsx`). In the source project this was
// `/coach/live/` — rename to match your app's routes.
const HOST_STUDIO_PATH = "/host/live";

function statusBadge(status: LiveRoomStatus) {
  switch (status) {
    case "scheduled":
      return <Badge variant="outline" className="border-blue-400 text-blue-600">Scheduled</Badge>;
    case "live":
      return <Badge className="bg-green-500 text-white animate-pulse">Live</Badge>;
    case "ended":
      return <Badge variant="secondary">Ended</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function recordingStatusBadge(status: LiveRecordingStatus) {
  switch (status) {
    case "recording":
      return <Badge className="bg-red-500 text-white animate-pulse">Recording</Badge>;
    case "processing":
      return <Badge variant="outline" className="border-amber-400 text-amber-600">Processing</Badge>;
    case "ready":
      return <Badge className="bg-green-500 text-white">Ready</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function LiveSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [recordings, setRecordings] = useState<LiveRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRoom = useCallback(async () => {
    const [roomRes, recRes] = await Promise.all([
      supabase
        .from("live_rooms")
        .select("*")
        .eq("id", roomId)
        .single(),
      supabase
        .from("live_recordings")
        .select("*")
        .eq("live_room_id", roomId)
        .order("started_at", { ascending: false }),
    ]);

    if (roomRes.error) {
      toast.error("Session not found");
      router.push("/live-sessions");
      return;
    }

    setRoom(roomRes.data);
    setRecordings(recRes.data ?? []);
    setLoading(false);
  }, [roomId, router]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      const res = await fetch("/api/livekit/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, roomId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Failed to ${action}`);
      }
      toast.success(
        action === "start"
          ? "Session is now live"
          : action === "end"
            ? "Session ended"
            : "Action completed"
      );
      loadRoom();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    }
    setActionLoading(null);
  }

  async function handleCancel() {
    setActionLoading("cancel");
    try {
      const { error } = await supabase
        .from("live_rooms")
        .update({ status: "cancelled" })
        .eq("id", roomId);
      if (error) throw error;
      toast.success("Session cancelled");
      loadRoom();
    } catch {
      toast.error("Failed to cancel session");
    }
    setActionLoading(null);
  }

  async function handleRecording(action: "start" | "stop") {
    setActionLoading(`recording-${action}`);
    try {
      const res = await fetch("/api/livekit/recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, roomId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Failed to ${action} recording`);
      }
      toast.success(action === "start" ? "Recording started" : "Recording stopped");
      loadRoom();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} recording`);
    }
    setActionLoading(null);
  }

  function copyShareLink() {
    const url = `${window.location.origin}/live/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  }

  if (loading || !room) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRecording = recordings.some((r) => r.status === "recording");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/live-sessions")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{room.title}</h1>
          <p className="text-muted-foreground">{room.description || "No description"}</p>
        </div>
        {statusBadge(room.status)}
      </div>

      {/* Room Details */}
      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Mode:</span>{" "}
              <span className="capitalize font-medium">{room.mode}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="capitalize font-medium">{room.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Scheduled Start:</span>{" "}
              <span className="font-medium">
                {new Date(room.scheduled_start).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Scheduled End:</span>{" "}
              <span className="font-medium">
                {room.scheduled_end
                  ? new Date(room.scheduled_end).toLocaleString()
                  : "—"}
              </span>
            </div>
            {room.actual_start && (
              <div>
                <span className="text-muted-foreground">Actual Start:</span>{" "}
                <span className="font-medium">
                  {new Date(room.actual_start).toLocaleString()}
                </span>
              </div>
            )}
            {room.actual_end && (
              <div>
                <span className="text-muted-foreground">Actual End:</span>{" "}
                <span className="font-medium">
                  {new Date(room.actual_end).toLocaleString()}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Max Participants:</span>{" "}
              <span className="font-medium">{room.max_participants}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Require Auth:</span>{" "}
              <span className="font-medium">{room.require_auth ? "Yes" : "No"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peak Viewers:</span>{" "}
              <span className="font-medium">{room.viewer_count_peak}</span>
            </div>
            {room.notes && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Notes:</span>{" "}
                <span className="font-medium">{room.notes}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Join as Host — prominent CTA when session is live */}
      {room.status === "live" && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <h3 className="font-semibold text-lg">Session is Live</h3>
              <p className="text-sm text-muted-foreground">
                Join the broadcast studio to stream your camera, mic, and screen to viewers.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => window.open(`${HOST_STUDIO_PATH}/${roomId}`, "_blank")}
            >
              <Video className="h-5 w-5 mr-2" />
              Join as Host
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {room.status === "scheduled" && (
            <>
              <Button
                onClick={async () => {
                  await handleAction("start");
                  window.open(`${HOST_STUDIO_PATH}/${roomId}`, "_blank");
                }}
                disabled={actionLoading !== null}
              >
                {actionLoading === "start" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Go Live &amp; Join
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={actionLoading !== null}
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Cancel
              </Button>
            </>
          )}
          {room.status === "live" && (
            <>
              <Button
                variant="destructive"
                onClick={() => handleAction("end")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "end" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                End Session
              </Button>
              {isRecording ? (
                <Button
                  variant="outline"
                  onClick={() => handleRecording("stop")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "recording-stop" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 mr-2 text-red-500" />
                  )}
                  Stop Recording
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => handleRecording("start")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "recording-start" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Circle className="h-4 w-4 mr-2 text-red-500" />
                  )}
                  Start Recording
                </Button>
              )}
            </>
          )}
          {room.status === "ended" && (
            <p className="text-muted-foreground text-sm">
              This session has ended.
            </p>
          )}
          {room.status === "cancelled" && (
            <p className="text-muted-foreground text-sm">
              This session was cancelled.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Share Link */}
      <Card>
        <CardHeader>
          <CardTitle>Share Link</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
            {typeof window !== "undefined"
              ? `${window.location.origin}/live/${roomId}`
              : `/live/${roomId}`}
          </code>
          <Button variant="outline" size="sm" onClick={copyShareLink}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </CardContent>
      </Card>

      {/* Recordings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              No recordings for this session.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>File Size</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>{recordingStatusBadge(rec.status)}</TableCell>
                    <TableCell>{formatDuration(rec.duration_seconds)}</TableCell>
                    <TableCell>{formatFileSize(rec.file_size_bytes)}</TableCell>
                    <TableCell>
                      {new Date(rec.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {rec.ended_at
                        ? new Date(rec.ended_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {rec.status === "ready" && rec.storage_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(rec.storage_url!, "_blank", "noopener,noreferrer")
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
