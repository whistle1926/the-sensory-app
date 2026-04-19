"use client";

// Host's own list of upcoming + live sessions they're assigned to.
// In the source project this lived at /coach/live — rename the route to
// whatever you use (e.g. /host/live). The studio page links are below.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { LiveRoom, LiveRoomStatus } from "@/lib/database.types";
import { toast } from "sonner";
import { Loader2, Radio, Calendar, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Route where the host studio page (`studio.tsx`) is mounted.
const HOST_STUDIO_PATH = "/host/live";

// If your `useAuth()` profile has a field that links to live_rooms.coach_id,
// set HOST_ID_FIELD to filter sessions to the current user's hosted sessions.
// Leave as null to show all scheduled/live sessions (host sees everything).
// Example: set to "coach_id" if profiles.coach_id matches live_rooms.coach_id.
const HOST_ID_FIELD: string | null = null;

function statusBadge(status: LiveRoomStatus) {
  switch (status) {
    case "scheduled":
      return (
        <Badge variant="outline" className="border-blue-400 text-blue-600">
          Scheduled
        </Badge>
      );
    case "live":
      return (
        <Badge className="bg-green-500 text-white animate-pulse">Live</Badge>
      );
    case "ended":
      return <Badge variant="secondary">Ended</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function modeBadge(mode: string) {
  return mode === "broadcast" ? (
    <Badge variant="outline" className="border-purple-400 text-purple-600">
      Broadcast
    </Badge>
  ) : (
    <Badge variant="outline" className="border-orange-400 text-orange-600">
      Interactive
    </Badge>
  );
}

export default function HostLivePage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let query = supabase
        .from("live_rooms")
        .select("*")
        .in("status", ["scheduled", "live"])
        .order("scheduled_start", { ascending: true });

      // Optionally filter sessions to those hosted by the current user.
      // Configured by HOST_ID_FIELD at the top of the file.
      if (HOST_ID_FIELD && profile.role !== "ADMIN") {
        const value = (profile as unknown as Record<string, unknown>)[HOST_ID_FIELD];
        if (typeof value === "string" && value) {
          query = query.eq("coach_id", value);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setRooms(data ?? []);
    } catch {
      toast.error("Failed to load sessions");
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!authLoading && profile) loadRooms();
  }, [authLoading, profile, loadRooms]);

  async function handleGoLive(roomId: string) {
    setStartingId(roomId);
    try {
      const res = await fetch("/api/livekit/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", roomId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to start session");
      }
      router.push(`${HOST_STUDIO_PATH}/${roomId}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start session",
      );
      setStartingId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Live Sessions</h1>
        <p className="text-muted-foreground">
          Upcoming and currently live sessions
        </p>
      </div>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No upcoming or live sessions right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{room.title}</CardTitle>
                  <div className="flex gap-1.5 shrink-0">
                    {modeBadge(room.mode)}
                    {statusBadge(room.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {room.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {room.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(room.scheduled_start).toLocaleDateString()}{" "}
                    {new Date(room.scheduled_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Max {room.max_participants}
                  </span>
                </div>

                {room.status === "live" ? (
                  <Button
                    className="w-full"
                    onClick={() => router.push(`${HOST_STUDIO_PATH}/${room.id}`)}
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    Join Session
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={startingId === room.id}
                    onClick={() => handleGoLive(room.id)}
                  >
                    {startingId === room.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Radio className="h-4 w-4 mr-2" />
                    )}
                    Go Live
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
