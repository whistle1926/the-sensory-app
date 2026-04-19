"use client";

// This admin form does not include host/group selection. If your project has
// related entities (e.g. a "hosts" or "teams" table), extend the form with your
// own dropdowns and set live_rooms.coach_id / school_id / event_schedule_id.
// Those columns still exist on the table but are optional and unused by default.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type {
  LiveRoom,
  LiveRoomMode,
  LiveRoomStatus,
} from "@/lib/database.types";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ChevronUp,
  Radio,
  Calendar,
  Video,
  CheckCircle,
  Eye,
  Trash2,
  Upload,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/datetime-picker";

interface SessionForm {
  title: string;
  description: string;
  mode: LiveRoomMode;
  scheduled_start: string;
  scheduled_end: string;
  max_participants: number;
  require_auth: boolean;
  notes: string;
  media_url: string;
  branding_title: string;
  branding_logo_url: string;
}

const emptyForm: SessionForm = {
  title: "",
  description: "",
  mode: "broadcast",
  scheduled_start: "",
  scheduled_end: "",
  max_participants: 100,
  require_auth: false,
  notes: "",
  media_url: "",
  branding_title: "",
  branding_logo_url: "",
};

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

export default function LiveSessionsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "live" | "history">("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState<SessionForm>(emptyForm);

  // Stats
  const [scheduledCount, setScheduledCount] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [endedCount, setEndedCount] = useState(0);
  const [recordingsCount, setRecordingsCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, recRes] = await Promise.all([
        supabase
          .from("live_rooms")
          .select("*")
          .order("scheduled_start", { ascending: false }),
        supabase.from("live_recordings").select("id", { count: "exact", head: true }),
      ]);

      if (roomsRes.data) {
        setRooms(roomsRes.data);
        setScheduledCount(roomsRes.data.filter((r) => r.status === "scheduled").length);
        setLiveCount(roomsRes.data.filter((r) => r.status === "live").length);
        setEndedCount(roomsRes.data.filter((r) => r.status === "ended").length);
      }
      setRecordingsCount(recRes.count ?? 0);
    } catch {
      toast.error("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.scheduled_start) {
      toast.error("Scheduled start is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/livekit/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: form.title.trim(),
          description: form.description.trim(),
          mode: form.mode,
          scheduled_start: new Date(form.scheduled_start).toISOString(),
          scheduled_end: form.scheduled_end
            ? new Date(form.scheduled_end).toISOString()
            : null,
          max_participants: form.max_participants,
          require_auth: form.require_auth,
          notes: form.notes.trim(),
          media_url: form.media_url.trim(),
          branding_title: form.branding_title.trim(),
          branding_logo_url: form.branding_logo_url.trim(),
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || "Failed to create session");
      }

      toast.success("Session created");
      if (Array.isArray(body?.stripped) && body.stripped.length > 0) {
        toast.warning(
          `These fields weren't saved because the DB migration is missing: ${body.stripped.join(", ")}. Apply the latest migration and recreate to persist them.`,
          { duration: 10000 },
        );
      }
      setForm(emptyForm);
      setShowForm(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    }
    setSubmitting(false);
  }

  async function handleDelete(roomId: string) {
    if (!confirm("Delete this session and its recordings? This cannot be undone.")) return;
    setDeleting(roomId);
    try {
      // Delete recordings first (cascade should handle it, but be explicit)
      await supabase.from("live_recordings").delete().eq("live_room_id", roomId);
      const { error } = await supabase.from("live_rooms").delete().eq("id", roomId);
      if (error) throw error;
      toast.success("Session deleted");
      loadData();
    } catch {
      toast.error("Failed to delete session");
    }
    setDeleting(null);
  }

  const filteredRooms = rooms.filter((r) => {
    if (filter === "upcoming") return r.status === "scheduled";
    if (filter === "live") return r.status === "live";
    if (filter === "history") return r.status === "ended" || r.status === "cancelled";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Sessions</h1>
          <p className="text-muted-foreground">
            Manage live broadcast and interactive sessions
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Hide Form
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </>
          )}
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{scheduledCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Live Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{liveCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recordings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{recordingsCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{endedCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inline Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Live Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Session title"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Session description"
                  rows={3}
                />
              </div>
              <div>
                <Label>Mode</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.mode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mode: e.target.value as LiveRoomMode }))
                  }
                >
                  <option value="broadcast">Broadcast</option>
                  <option value="interactive">Interactive</option>
                </select>
              </div>
              <div>
                <Label>Max Participants</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_participants}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, max_participants: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Scheduled Start</Label>
                <DateTimePicker
                  value={form.scheduled_start}
                  onChange={(v) => setForm((f) => ({ ...f, scheduled_start: v }))}
                />
              </div>
              <div>
                <Label>Scheduled End (optional)</Label>
                <DateTimePicker
                  value={form.scheduled_end}
                  onChange={(v) => setForm((f) => ({ ...f, scheduled_end: v }))}
                  placeholder="Pick end date & time"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="require_auth"
                  checked={form.require_auth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, require_auth: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="require_auth">Require Authentication</Label>
              </div>
              <div className="md:col-span-2 rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-3">
                <div>
                  <Label className="text-base">Branding (optional)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Override the default page header — useful for tutoring
                    calls, guest speakers, or partner-branded events.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-normal">Page title</Label>
                    <Input
                      value={form.branding_title}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, branding_title: e.target.value }))
                      }
                      placeholder="Live Stream"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-normal">Logo URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.branding_logo_url}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            branding_logo_url: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="flex-1"
                      />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        id="logo-file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingLogo(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            // Logos are images, not videos — the `live-media`
                            // bucket only accepts video/*. Route them to the
                            // shared `images` bucket under a sessions folder.
                            fd.append("bucket", "images");
                            fd.append("folder", "live-session-logos");
                            const res = await fetch("/api/upload", {
                              method: "POST",
                              body: fd,
                            });
                            const body = await res.json();
                            if (!res.ok)
                              throw new Error(body?.error || "Upload failed");
                            setForm((f) => ({
                              ...f,
                              branding_logo_url: body.url,
                            }));
                            toast.success("Logo uploaded");
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Upload failed",
                            );
                          } finally {
                            setUploadingLogo(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() =>
                          document.getElementById("logo-file")?.click()
                        }
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                {form.branding_logo_url && (
                  <div className="flex items-center gap-3 pt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.branding_logo_url}
                      alt="Logo preview"
                      className="h-10 w-auto rounded border bg-white p-1 object-contain"
                    />
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {form.branding_logo_url}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setForm((f) => ({ ...f, branding_logo_url: "" }))
                      }
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <Label>
                  Pre-recorded video (optional)
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — paste an MP4/WebM URL or upload a file to play during the stream
                  </span>
                </Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  <Input
                    value={form.media_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, media_url: e.target.value }))
                    }
                    placeholder="https://example.com/video.mp4"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      id="media-file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingMedia(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("bucket", "live-media");
                          fd.append("folder", "sessions");
                          const res = await fetch("/api/upload", {
                            method: "POST",
                            body: fd,
                          });
                          const body = await res.json();
                          if (!res.ok) throw new Error(body?.error || "Upload failed");
                          setForm((f) => ({ ...f, media_url: body.url }));
                          toast.success("Video uploaded");
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Upload failed",
                          );
                        } finally {
                          setUploadingMedia(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingMedia}
                      onClick={() =>
                        document.getElementById("media-file")?.click()
                      }
                    >
                      {uploadingMedia ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          Uploading
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1.5" />
                          Upload
                        </>
                      )}
                    </Button>
                    {form.media_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, media_url: "" }))}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                {form.media_url && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    Attached:{" "}
                    <a
                      href={form.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      {form.media_url}
                    </a>
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sessions</CardTitle>
            <div className="flex gap-1">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "upcoming", label: "Upcoming" },
                  { key: "live", label: "Live" },
                  { key: "history", label: "History" },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.key}
                  size="sm"
                  variant={filter === tab.key ? "default" : "ghost"}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                  {tab.key !== "all" && (
                    <span className="ml-1.5 text-xs opacity-70">
                      {tab.key === "upcoming"
                        ? scheduledCount
                        : tab.key === "live"
                          ? liveCount
                          : endedCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRooms.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {filter === "all"
                ? "No sessions found. Create one above."
                : `No ${filter} sessions.`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled Start</TableHead>
                  {filter === "history" && <TableHead>Duration</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => {
                  const duration =
                    room.actual_start && room.actual_end
                      ? Math.round(
                          (new Date(room.actual_end).getTime() -
                            new Date(room.actual_start).getTime()) /
                            60000,
                        )
                      : null;

                  return (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.title}</TableCell>
                      <TableCell className="capitalize">{room.mode}</TableCell>
                      <TableCell>{statusBadge(room.status)}</TableCell>
                      <TableCell>
                        {new Date(room.scheduled_start).toLocaleDateString()}{" "}
                        {new Date(room.scheduled_start).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      {filter === "history" && (
                        <TableCell>
                          {duration != null ? `${duration} min` : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/live-sessions/${room.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {(room.status === "ended" || room.status === "cancelled") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deleting === room.id}
                              onClick={() => handleDelete(room.id)}
                            >
                              {deleting === room.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
