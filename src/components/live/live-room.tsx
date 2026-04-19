"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  roomId: string;
  /** Shown above the video area. */
  title?: string;
  /** Tweaks layout — host gets pre-join camera preview, viewer goes straight in. */
  role: "host" | "viewer";
}

/**
 * Thin wrapper around LiveKit's prebuilt <VideoConference /> that handles
 * token fetching + connection state + basic error surfaces. Used by both
 * the admin host studio and the public viewer page — same UI, different
 * publish permissions (which the server enforces via the token grant).
 */
export function LiveRoom({ roomId, title, role }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not fetch token");
        }
        return r.json();
      })
      .then((data) => {
        setToken(data.token);
        setWsUrl(data.wsUrl);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load."),
      );
  }, [roomId]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-10 text-center dark:bg-red-950/20">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold">Can&apos;t join this session</p>
        <p className="max-w-md text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!token || !wsUrl) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Connecting to the room…
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: role === "host" ? "calc(100vh - 64px - 4rem)" : "calc(100vh - 4rem)",
        minHeight: "500px",
      }}
      className="overflow-hidden rounded-2xl border border-border bg-black"
    >
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect
        video={role === "host"}
        audio={role === "host"}
        data-lk-theme="default"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {title && (
        <p className="sr-only" aria-live="polite">
          {title}
        </p>
      )}
    </div>
  );
}
