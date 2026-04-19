"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Radio } from "lucide-react";
import { LiveRoom } from "@/components/live/live-room";

interface RoomInfo {
  id: string;
  title: string;
  description: string;
  mode: "broadcast" | "interactive";
  status: "scheduled" | "live" | "ended" | "cancelled";
  brandingTitle: string | null;
  brandingLogoUrl: string | null;
  host: { id: string; name: string } | null;
}

/**
 * Public viewer page for live sessions. Anyone with the link can land here;
 * the token endpoint decides whether they can publish (interactive) or
 * only watch (broadcast). If the session isn't live yet the viewer gets
 * a friendly waiting screen instead of the LiveKit connection attempt.
 */
export default function LiveViewerPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/livekit/public/rooms/${roomId}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error ?? "Not found");
        }
        return r.json();
      })
      .then(setRoom)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Not found"),
      );
  }, [roomId]);

  const display = {
    title: room?.brandingTitle ?? room?.title ?? "",
    logo: room?.brandingLogoUrl,
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      {/* Minimal public header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            {display.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={display.logo}
                alt=""
                className="h-9 w-auto max-w-[120px]"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
                  <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
                  <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
                  <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
                </svg>
              </div>
            )}
            <span className="hidden text-lg font-bold tracking-tight sm:inline">
              {display.title || "The Sensory Submarine"}
            </span>
          </Link>
          {room?.status === "live" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Live
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-10 text-center dark:bg-red-950/20">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-sm font-semibold">
              Can&apos;t load this session
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{err}</p>
          </div>
        )}

        {!err && !room && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {room && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">
                {room.title}
              </h1>
              {room.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {room.description}
                </p>
              )}
              {room.host && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Hosted by <strong>{room.host.name}</strong>
                </p>
              )}
            </div>

            {room.status === "live" && (
              <LiveRoom roomId={room.id} role="viewer" />
            )}

            {room.status === "scheduled" && (
              <div className="rounded-3xl border border-border bg-white p-12 text-center shadow-[var(--shadow-sm)]">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Radio className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold tracking-tight">
                  This session hasn&apos;t started yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  The host will start broadcasting shortly. Keep this page
                  open — it&apos;ll update automatically.
                </p>
              </div>
            )}

            {room.status === "ended" && (
              <div className="rounded-3xl border border-border bg-white p-12 text-center shadow-[var(--shadow-sm)]">
                <h2 className="text-xl font-bold tracking-tight">
                  This session has ended
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Thanks for coming. A recording may be available later.
                </p>
              </div>
            )}

            {room.status === "cancelled" && (
              <div className="rounded-3xl border border-border bg-white p-12 text-center shadow-[var(--shadow-sm)]">
                <h2 className="text-xl font-bold tracking-tight">
                  This session was cancelled
                </h2>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
