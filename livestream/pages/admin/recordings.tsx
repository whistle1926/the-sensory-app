"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { LiveRecording, LiveRecordingStatus } from "@/lib/database.types";
import { toast } from "sonner";
import { Loader2, Video, ExternalLink } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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

type RecordingWithRoom = LiveRecording & {
  live_rooms?: { title: string } | null;
};

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<RecordingWithRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("live_recordings")
        .select("*, live_rooms(title)")
        .order("started_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecordings(data ?? []);
    } catch {
      toast.error("Failed to load recordings");
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recordings</h1>
        <p className="text-muted-foreground">
          Browse and manage all session recordings
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div>
              <Label>Status</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[160px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="recording">Recording</option>
                <option value="processing">Processing</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recordings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            All Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recordings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No recordings found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Title</TableHead>
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
                    <TableCell className="font-medium">
                      {(rec.live_rooms as { title: string } | null)?.title ?? "Unknown"}
                    </TableCell>
                    <TableCell>{recordingStatusBadge(rec.status)}</TableCell>
                    <TableCell>{formatDuration(rec.duration_seconds)}</TableCell>
                    <TableCell>{formatFileSize(rec.file_size_bytes)}</TableCell>
                    <TableCell>
                      {new Date(rec.started_at).toLocaleDateString()}{" "}
                      {new Date(rec.started_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {rec.ended_at
                        ? `${new Date(rec.ended_at).toLocaleDateString()} ${new Date(
                            rec.ended_at
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
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
                          Play
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
