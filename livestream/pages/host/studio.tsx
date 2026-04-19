"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Circle,
  Square,
  Users,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  MessageCircle,
  Send,
  VolumeX,
  Volume2,
  UserX,
  UserPlus,
  UserMinus,
  PictureInPicture2,
  Pin,
  PinOff,
  ExternalLink,
  Film,
  Play,
  X,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent, DataPacket_Kind } from "livekit-client";
import type { LiveRoom } from "@/lib/database.types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
  senderIdentity?: string;
}

interface PinnedLink {
  url: string;
  label: string;
}

interface LatestChat {
  sender: string;
  text: string;
  timestamp: number;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  offset: number; // 0-100% horizontal
}

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "🙌", "😂"];

/* ------------------------------------------------------------------ */
/* Safe URL validation — prevents javascript: / data: URLs from pin    */
/* ------------------------------------------------------------------ */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* useRoomBroadcast — tracks latest chat + pinned link from data chan */
/* ------------------------------------------------------------------ */
function useRoomBroadcast(isHost: boolean) {
  const room = useRoomContext();
  const [latestChat, setLatestChat] = useState<LatestChat | null>(null);
  const [pinnedLink, setPinnedLinkState] = useState<PinnedLink | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [stageIdentities, setStageIdentitiesState] = useState<Set<string>>(
    () => new Set(),
  );
  const pinnedLinkRef = useRef<PinnedLink | null>(null);
  const stageIdentitiesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pinnedLinkRef.current = pinnedLink;
  }, [pinnedLink]);

  useEffect(() => {
    stageIdentitiesRef.current = stageIdentities;
  }, [stageIdentities]);

  const addReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const offset = 5 + Math.random() * 70; // keep away from right edge
    setReactions((prev) => [...prev, { id, emoji, offset }]);
    // Auto-remove after animation completes (3s)
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const decoder = new TextDecoder();

    const handleData = (
      payload: Uint8Array,
      participant: { identity: string; name?: string } | undefined,
    ) => {
      try {
        const parsed = JSON.parse(decoder.decode(payload));
        if (parsed.type === "chat") {
          setLatestChat({
            sender:
              parsed.sender ||
              participant?.name ||
              participant?.identity ||
              "Unknown",
            text: parsed.text,
            timestamp: Date.now(),
          });
        } else if (parsed.type === "pin") {
          if (parsed.cleared) {
            setPinnedLinkState(null);
          } else if (parsed.url && typeof parsed.url === "string") {
            const safeUrl = normalizeUrl(parsed.url);
            if (safeUrl) {
              setPinnedLinkState({
                url: safeUrl,
                label: (parsed.label || safeUrl).toString().slice(0, 200),
              });
            }
          }
        } else if (parsed.type === "reaction") {
          if (
            typeof parsed.emoji === "string" &&
            REACTION_EMOJIS.includes(parsed.emoji)
          ) {
            addReaction(parsed.emoji);
          }
        } else if (parsed.type === "stage") {
          if (Array.isArray(parsed.identities)) {
            const next = new Set<string>(
              parsed.identities.filter((x: unknown) => typeof x === "string"),
            );
            setStageIdentitiesState(next);
          }
        }
      } catch {
        // ignore non-JSON or malformed payloads
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // Host re-broadcasts the current pin whenever a new participant joins,
  // so late viewers pick it up (data channels don't replay).
  useEffect(() => {
    if (!isHost) return;
    const handleJoin = async () => {
      const encoder = new TextEncoder();
      const pin = pinnedLinkRef.current;
      if (pin) {
        try {
          await room.localParticipant.publishData(
            encoder.encode(JSON.stringify({ type: "pin", ...pin })),
            { reliable: true },
          );
        } catch {
          // silent
        }
      }
      // Also re-broadcast the current stage set so late joiners learn
      // who's on camera (data channels don't replay).
      const stage = Array.from(stageIdentitiesRef.current);
      if (stage.length > 0) {
        try {
          await room.localParticipant.publishData(
            encoder.encode(
              JSON.stringify({ type: "stage", identities: stage }),
            ),
            { reliable: true },
          );
        } catch {
          // silent
        }
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleJoin);
    };
  }, [isHost, room]);

  const setPinnedLink = useCallback(
    async (link: PinnedLink | null) => {
      const encoder = new TextEncoder();
      const payload = link
        ? { type: "pin", url: link.url, label: link.label }
        : { type: "pin", cleared: true };
      try {
        await room.localParticipant.publishData(
          encoder.encode(JSON.stringify(payload)),
          { reliable: true },
        );
        setPinnedLinkState(link);
      } catch (err) {
        console.error("Failed to broadcast pin:", err);
        toast.error("Failed to update pinned link");
      }
    },
    [room],
  );

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!REACTION_EMOJIS.includes(emoji)) return;
      // Show locally immediately for snappy UX
      addReaction(emoji);
      try {
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(
          encoder.encode(JSON.stringify({ type: "reaction", emoji })),
          { reliable: false },
        );
      } catch {
        // silent — local reaction is enough feedback
      }
    },
    [room, addReaction],
  );

  // Host-only: invite a viewer onto the stage (server flips their
  // canPublish permission, then we broadcast the updated identity set).
  const setOnStage = useCallback(
    async (roomName: string, identity: string, onStage: boolean) => {
      const res = await fetch("/api/livekit/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: onStage ? "inviteToStage" : "removeFromStage",
          roomName,
          identity,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to update stage");
      }
      const next = new Set(stageIdentitiesRef.current);
      if (onStage) next.add(identity);
      else next.delete(identity);
      setStageIdentitiesState(next);
      try {
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(
          encoder.encode(
            JSON.stringify({
              type: "stage",
              identities: Array.from(next),
            }),
          ),
          { reliable: true },
        );
      } catch {
        // silent — local state is still correct
      }
    },
    [room],
  );

  return {
    latestChat,
    pinnedLink,
    setPinnedLink,
    reactions,
    sendReaction,
    stageIdentities,
    setOnStage,
  };
}

/* ------------------------------------------------------------------ */
/* NewsTicker — bottom overlay: pinned link + scrolling latest chat   */
/* ------------------------------------------------------------------ */
function NewsTicker({
  latestChat,
  pinnedLink,
}: {
  latestChat: LatestChat | null;
  pinnedLink: PinnedLink | null;
}) {
  if (!latestChat && !pinnedLink) return null;

  return (
    <div className="absolute left-0 right-0 bottom-0 z-10 flex items-stretch bg-black/80 backdrop-blur-sm text-white text-sm border-t border-white/10">
      {/* Pinned link — obvious, wide button */}
      {pinnedLink && (
        <a
          href={pinnedLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 transition-colors shrink-0 min-w-[180px] max-w-[60%] cursor-pointer"
          title={`Open ${pinnedLink.url}`}
        >
          <span className="flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase tracking-wider bg-white/20 rounded px-1.5 py-0.5">
            <Pin className="h-3 w-3" />
            Link
          </span>
          <span className="truncate font-semibold text-white">
            {pinnedLink.label}
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
        </a>
      )}

      {/* Latest chat — scrolling marquee */}
      {latestChat && (
        <div className="flex-1 overflow-hidden py-2 px-3 min-w-0">
          <div
            key={latestChat.timestamp}
            className="whitespace-nowrap news-ticker-scroll"
          >
            <span className="text-red-400 font-semibold mr-2">
              LIVE CHAT
            </span>
            <span className="font-medium">{latestChat.sender}:</span>{" "}
            <span className="text-white/90">{latestChat.text}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .news-ticker-scroll {
          display: inline-block;
          padding-left: 100%;
          animation: news-ticker 18s linear;
          animation-iteration-count: 1;
        }
        @keyframes news-ticker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ReactionLayer — floating emojis that rise and fade over the video  */
/* ------------------------------------------------------------------ */
function ReactionLayer({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-12 text-3xl sm:text-4xl reaction-float"
          style={{ left: `${r.offset}%` }}
        >
          {r.emoji}
        </span>
      ))}
      <style jsx>{`
        .reaction-float {
          animation: reaction-rise 3s ease-out forwards;
        }
        @keyframes reaction-rise {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          15% {
            transform: translateY(-20px) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translateY(-260px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ControlButton — circular pill button for the studio control rail.   */
/* Icon-only on mobile, icon + label on ≥sm. Colors follow Meet/Teams   */
/* conventions (red = danger/mic-off, white = active, translucent = off)*/
/* ------------------------------------------------------------------ */
function ControlButton({
  label,
  icon: Icon,
  active,
  danger,
  loading,
  pulse,
  onClick,
  title,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  danger?: boolean;
  loading?: boolean;
  pulse?: boolean;
  onClick: () => void;
  title?: string;
}) {
  // Variant classes — danger beats active beats default.
  const variant = danger
    ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30"
    : active
      ? "bg-white text-neutral-900 hover:bg-white/90 shadow-md"
      : "bg-white/10 hover:bg-white/20 text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
      className={`group relative inline-flex items-center justify-center gap-2 h-11 min-w-11 sm:min-w-[88px] px-3 sm:px-4 rounded-full font-medium text-sm transition-all active:scale-95 disabled:opacity-60 ${variant}`}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Icon
          className={`h-5 w-5 ${pulse ? "animate-pulse" : ""}`}
        />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* ReactionBar — tap an emoji to broadcast a reaction to everyone     */
/* ------------------------------------------------------------------ */
function ReactionBar({
  onReact,
  className,
}: {
  onReact: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-1 ${className ?? ""}`}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="h-9 w-9 rounded-full hover:bg-white/20 active:scale-90 transition-all text-xl flex items-center justify-center"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MediaPanel — popover over the Media button: paste/play a video URL */
/* ------------------------------------------------------------------ */
function MediaPanel({
  url,
  onChange,
  isPlaying,
  loading,
  onTogglePlay,
  onClose,
}: {
  url: string;
  onChange: (url: string) => void;
  isPlaying: boolean;
  loading: boolean;
  onTogglePlay: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[min(92vw,20rem)] rounded-lg border bg-background shadow-xl p-3 z-50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Film className="h-4 w-4" />
            Pre-recorded media
          </div>
          {isPlaying && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500">
              <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
              Playing
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Paste a direct{" "}
          <span className="font-semibold text-foreground">.mp4 / .webm</span>{" "}
          URL. YouTube / Vimeo links won&apos;t work here — for those, open
          the video in a tab and use{" "}
          <span className="font-semibold text-foreground">Screen Share</span>{" "}
          instead.
        </p>
        <Input
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/video.mp4"
          disabled={isPlaying || loading}
          className="text-sm h-9"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isPlaying ? "destructive" : "default"}
            disabled={loading || (!isPlaying && !url.trim())}
            onClick={onTogglePlay}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : isPlaying ? (
              <Square className="h-4 w-4 mr-1.5" />
            ) : (
              <Play className="h-4 w-4 mr-1.5" />
            )}
            {isPlaying ? "Stop" : "Play to viewers"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* PinLinkControl — host-only: set/clear the pinned link              */
/* ------------------------------------------------------------------ */
function PinLinkControl({
  pinnedLink,
  onPin,
}: {
  pinnedLink: PinnedLink | null;
  onPin: (link: PinnedLink | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function handlePin() {
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) {
      toast.error("Please enter a valid URL");
      return;
    }
    setSaving(true);
    await onPin({ url: safeUrl, label: label.trim() || safeUrl });
    setSaving(false);
    setOpen(false);
    setUrl("");
    setLabel("");
    toast.success("Link pinned to screen");
  }

  async function handleUnpin() {
    setSaving(true);
    await onPin(null);
    setSaving(false);
    toast.success("Link unpinned");
  }

  if (pinnedLink) {
    return (
      <div className="border-b border-neutral-800 bg-red-500/10 px-3 py-2 flex items-center gap-2">
        <Pin className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="text-xs truncate flex-1 text-neutral-300">{pinnedLink.label}</span>
        <button
          className="h-7 px-2 rounded text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-40"
          onClick={handleUnpin}
          disabled={saving}
        >
          <PinOff className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-800">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full px-3 py-2 text-xs text-neutral-500 hover:bg-white/5 hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5"
        >
          <Pin className="h-3.5 w-3.5" />
          Pin a link to the screen
        </button>
      ) : (
        <div className="p-2 space-y-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-500"
            autoFocus
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="h-8 text-sm bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-500"
            onKeyDown={(e) => e.key === "Enter" && handlePin()}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-7"
              onClick={handlePin}
              disabled={saving || !url.trim()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Pin"
              )}
            </Button>
            <button
              className="h-7 px-2 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
              onClick={() => {
                setOpen(false);
                setUrl("");
                setLabel("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LocalVideoPreview — shows screen share (if active) as main view,    */
/* with camera as PiP overlay. Supports browser Picture-in-Picture.    */
/* ------------------------------------------------------------------ */
function LocalVideoPreview() {
  const mainRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLVideoElement>(null);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [hasCamera, setHasCamera] = useState(false);
  const [hasScreen, setHasScreen] = useState(false);
  const [nativePipActive, setNativePipActive] = useState(false);

  const attachTracks = useCallback(() => {
    const cameraPub = localParticipant.getTrackPublication(Track.Source.Camera);
    const screenPub = localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    );
    const cameraTrack = cameraPub?.track;
    const screenTrack = screenPub?.track;

    const hasCam = !!cameraTrack && !cameraPub?.isMuted;
    const hasScr = !!screenTrack && !screenPub?.isMuted;

    if (hasScr && screenTrack && mainRef.current) {
      // Screen share in main view, camera in PiP (if present)
      screenTrack.attach(mainRef.current);
      if (hasCam && cameraTrack && pipRef.current) {
        cameraTrack.attach(pipRef.current);
      }
    } else if (hasCam && cameraTrack && mainRef.current) {
      // Camera only — main view
      cameraTrack.attach(mainRef.current);
    }

    setHasCamera(hasCam);
    setHasScreen(hasScr);
  }, [localParticipant]);

  useEffect(() => {
    attachTracks();

    const onChange = () => setTimeout(attachTracks, 50);

    room.on(RoomEvent.LocalTrackPublished, onChange);
    room.on(RoomEvent.LocalTrackUnpublished, onChange);
    room.on(RoomEvent.TrackMuted, onChange);
    room.on(RoomEvent.TrackUnmuted, onChange);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onChange);
      room.off(RoomEvent.LocalTrackUnpublished, onChange);
      room.off(RoomEvent.TrackMuted, onChange);
      room.off(RoomEvent.TrackUnmuted, onChange);
    };
  }, [room, attachTracks]);

  // Browser-native Picture-in-Picture (pop the main video into a floating window)
  useEffect(() => {
    const video = mainRef.current;
    if (!video) return;
    const onEnter = () => setNativePipActive(true);
    const onLeave = () => setNativePipActive(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  async function togglePiP() {
    const video = mainRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      } else {
        toast.error("Picture-in-Picture not supported in this browser");
      }
    } catch (err) {
      console.error("PiP error:", err);
      toast.error("Could not toggle Picture-in-Picture");
    }
  }

  const showMainVideo = hasScreen || hasCamera;
  const showCameraPip = hasScreen && hasCamera;
  // Only offer PiP button when there's something to pop out
  const pipAvailable =
    typeof window !== "undefined" &&
    document.pictureInPictureEnabled &&
    showMainVideo;

  return (
    <>
      {/* Main video (screen share if active, else camera) */}
      <video
        ref={mainRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-contain ${showMainVideo ? "" : "hidden"}`}
      />

      {/*
        Camera PiP overlay — always rendered so the ref is available when
        attachTracks runs. Hidden visually when not screen-sharing.
      */}
      <div
        className={`absolute bottom-3 right-3 w-40 h-28 sm:w-56 sm:h-40 rounded-lg overflow-hidden border-2 border-white/30 shadow-lg bg-black transition-opacity ${
          showCameraPip ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <video
          ref={pipRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Screen share badge */}
      {hasScreen && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-md">
          <MonitorUp className="h-3.5 w-3.5" />
          Sharing screen
        </div>
      )}

      {/* PiP pop-out button */}
      {pipAvailable && (
        <button
          type="button"
          onClick={togglePiP}
          title={nativePipActive ? "Exit Picture-in-Picture" : "Pop out video"}
          className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors"
        >
          <PictureInPicture2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {nativePipActive ? "Exit PiP" : "Pop out"}
          </span>
        </button>
      )}

      {/* Empty state */}
      {!showMainVideo && (
        <div className="text-white/50 flex flex-col items-center gap-3">
          <VideoOff className="h-10 w-10" />
          <p className="text-sm">Camera off</p>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* GuestStage — renders cameras of participants currently on stage    */
/* ------------------------------------------------------------------ */
function GuestStage({ stageIdentities }: { stageIdentities: Set<string> }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const guestTracks = tracks.filter(
    (t) =>
      !t.participant.isLocal && stageIdentities.has(t.participant.identity),
  );
  if (guestTracks.length === 0) return null;

  // Simple responsive grid: 1 guest = full column, 2+ = split rows.
  const rows = guestTracks.length === 1 ? "grid-rows-1" : "grid-rows-2";
  return (
    <div className={`h-full grid ${rows} gap-1 bg-black`}>
      {guestTracks.map((trackRef) => (
        <div
          key={trackRef.publication?.trackSid}
          className="relative overflow-hidden"
        >
          <VideoTrack
            trackRef={trackRef}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
            {trackRef.participant.name || trackRef.participant.identity}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Types for participant management                                   */
/* ------------------------------------------------------------------ */
interface RemoteParticipantInfo {
  identity: string;
  name: string;
  joinedAt: number;
  tracks: { sid: string; source: number; type: number; muted: boolean }[];
  isSpeaking: boolean;
}

/* ------------------------------------------------------------------ */
/* ParticipantsPanel — list + mute/kick controls for host             */
/* ------------------------------------------------------------------ */
function ParticipantsPanel({
  roomName,
  stageIdentities,
  onStageToggle,
}: {
  roomName: string;
  stageIdentities: Set<string>;
  onStageToggle: (identity: string, onStage: boolean) => Promise<void>;
}) {
  const [participants, setParticipants] = useState<RemoteParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { localParticipant } = useLocalParticipant();

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/livekit/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", roomName }),
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out local participant
        setParticipants(
          (data.participants || []).filter(
            (p: RemoteParticipantInfo) => p.identity !== localParticipant.identity,
          ),
        );
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [roomName, localParticipant.identity]);

  useEffect(() => {
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 5000);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  function isAudioMuted(p: RemoteParticipantInfo) {
    const audioTracks = p.tracks.filter((t) => t.type === 1);
    return audioTracks.length === 0 || audioTracks.every((t) => t.muted);
  }

  async function handleMuteToggle(p: RemoteParticipantInfo) {
    const muted = isAudioMuted(p);
    setActionLoading(p.identity);
    try {
      const res = await fetch("/api/livekit/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: muted ? "unmuteAll" : "muteAll",
          roomName,
          identity: p.identity,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(muted ? `Unmuted ${p.name}` : `Muted ${p.name}`);
      await fetchParticipants();
    } catch {
      toast.error("Failed to update participant");
    }
    setActionLoading(null);
  }

  async function handleKick(p: RemoteParticipantInfo) {
    if (!confirm(`Remove ${p.name} from the session?`)) return;
    setActionLoading(p.identity);
    try {
      const res = await fetch("/api/livekit/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          roomName,
          identity: p.identity,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Removed ${p.name}`);
      await fetchParticipants();
    } catch {
      toast.error("Failed to remove participant");
    }
    setActionLoading(null);
  }

  async function handleStageToggle(p: RemoteParticipantInfo) {
    const isOnStage = stageIdentities.has(p.identity);
    setActionLoading(p.identity);
    try {
      await onStageToggle(p.identity, !isOnStage);
      toast.success(
        isOnStage
          ? `${p.name} removed from stage`
          : `${p.name} invited on stage`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update stage",
      );
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="text-center text-xs text-neutral-500 mt-8 px-4">
        No viewers have joined yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-800">
      {participants.map((p) => {
        const muted = isAudioMuted(p);
        const busy = actionLoading === p.identity;
        const onStage = stageIdentities.has(p.identity);
        return (
          <div
            key={p.identity}
            className={`flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 ${
              onStage ? "bg-sky-500/10" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1.5 text-neutral-200">
                {p.name}
                {onStage && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-sky-600 text-white rounded px-1 py-0.5">
                    On stage
                  </span>
                )}
              </p>
              <p className="text-[10px] text-neutral-500">
                {p.tracks.filter((t) => t.type === 1).length > 0
                  ? muted
                    ? "Audio muted"
                    : "Audio on"
                  : onStage
                    ? "Invited — waiting for camera"
                    : "Viewer"}
              </p>
            </div>
            <button
              className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                onStage
                  ? "bg-sky-600 text-white hover:bg-sky-500"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
              } disabled:opacity-40`}
              disabled={busy}
              onClick={() => handleStageToggle(p)}
              title={onStage ? "Remove from stage" : "Invite on stage"}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : onStage ? (
                <UserMinus className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                muted
                  ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              } disabled:opacity-40`}
              disabled={busy || p.tracks.filter((t) => t.type === 1).length === 0}
              onClick={() => handleMuteToggle(p)}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center bg-neutral-800 text-neutral-500 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-40"
              disabled={busy}
              onClick={() => handleKick(p)}
              title="Remove from session"
            >
              <UserX className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ChatPanel — tabbed: Chat + Participants with mute controls         */
/* ------------------------------------------------------------------ */
function ChatPanel({
  senderName,
  roomName,
  pinnedLink,
  onPin,
  stageIdentities,
  onStageToggle,
}: {
  senderName: string;
  roomName: string;
  pinnedLink: PinnedLink | null;
  onPin: (link: PinnedLink | null) => Promise<void>;
  stageIdentities: Set<string>;
  onStageToggle: (identity: string, onStage: boolean) => Promise<void>;
}) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"chat" | "participants">("chat");
  const [muteLoading, setMuteLoading] = useState<string | null>(null);

  // Listen for incoming data messages
  useEffect(() => {
    const decoder = new TextDecoder();

    const handleData = (
      payload: Uint8Array,
      participant: { identity: string; name?: string } | undefined,
    ) => {
      try {
        const parsed = JSON.parse(decoder.decode(payload));
        if (parsed.type === "chat") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              sender:
                parsed.sender ||
                participant?.name ||
                participant?.identity ||
                "Unknown",
              text: parsed.text,
              timestamp: Date.now(),
              isLocal: false,
              senderIdentity: participant?.identity,
            },
          ]);
        }
      } catch {
        // ignore non-chat data
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // Always pin the chat view to the newest message
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Use requestAnimationFrame so the scroll happens after layout commits
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, tab]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify({ type: "chat", sender: senderName, text }),
    );

    try {
      await room.localParticipant.publishData(data, {
        reliable: true,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sender: senderName,
          text,
          timestamp: Date.now(),
          isLocal: true,
        },
      ]);
      setDraft("");
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    }
  }

  async function handleMuteFromChat(identity: string, name: string) {
    setMuteLoading(identity);
    try {
      const res = await fetch("/api/livekit/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "muteAll",
          roomName,
          identity,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Muted ${name}`);
    } catch {
      toast.error("Failed to mute participant");
    }
    setMuteLoading(null);
  }

  // Tiny avatar helper — deterministic color per sender so remote messages
  // get a visual cue without needing profile photos.
  const avatarFor = (name: string) => {
    const palette = [
      "bg-rose-500",
      "bg-amber-500",
      "bg-emerald-500",
      "bg-sky-500",
      "bg-violet-500",
      "bg-pink-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  };
  const initialOf = (name: string) =>
    name.trim().charAt(0).toUpperCase() || "?";

  // Colour per sender name — deterministic from hash
  const nameColor = (name: string) => {
    const colors = [
      "text-sky-400",
      "text-emerald-400",
      "text-amber-400",
      "text-rose-400",
      "text-violet-400",
      "text-pink-400",
      "text-teal-400",
      "text-orange-400",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return colors[hash % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800">
      {/* Tab header */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 px-3 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative ${
            tab === "chat"
              ? "text-neutral-100"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Chat
          {tab === "chat" && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-sky-500" />
          )}
        </button>
        <button
          onClick={() => setTab("participants")}
          className={`flex-1 px-3 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative ${
            tab === "participants"
              ? "text-neutral-100"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Users className="h-4 w-4" />
          People
          {tab === "participants" && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-sky-500" />
          )}
        </button>
      </div>

      {tab === "participants" ? (
        <div className="flex-1 overflow-y-auto">
          <ParticipantsPanel
            roomName={roomName}
            stageIdentities={stageIdentities}
            onStageToggle={onStageToggle}
          />
        </div>
      ) : (
        <>
          {/* Host pin-link control */}
          <PinLinkControl pinnedLink={pinnedLink} onPin={onPin} />

          {/* Messages — YouTube Live style: compact inline, no bubbles */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-16 text-center px-4">
                <MessageCircle className="h-8 w-8 text-neutral-600 mb-2" />
                <p className="text-sm text-neutral-400">No messages yet</p>
                <p className="text-xs text-neutral-600 mt-1">
                  Say hello to start chatting
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-2 py-1 px-1 rounded hover:bg-white/5 group"
              >
                <div
                  className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5 ${avatarFor(msg.sender)}`}
                  aria-hidden
                >
                  {initialOf(msg.sender)}
                </div>
                <p className="text-sm leading-relaxed min-w-0 flex-1">
                  <span className={`font-semibold mr-1.5 ${msg.isLocal ? "text-sky-400" : nameColor(msg.sender)}`}>
                    {msg.isLocal ? "You" : msg.sender}
                  </span>
                  <span className="text-neutral-200 break-words">{msg.text}</span>
                  {!msg.isLocal && msg.senderIdentity && (
                    <button
                      onClick={() =>
                        handleMuteFromChat(msg.senderIdentity!, msg.sender)
                      }
                      disabled={muteLoading === msg.senderIdentity}
                      className="inline-flex ml-1.5 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      title={`Mute ${msg.sender}`}
                    >
                      {muteLoading === msg.senderIdentity ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <VolumeX className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-2.5 border-t border-neutral-800 flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              placeholder="Send a message..."
              className="text-sm h-10 rounded-full bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus-visible:ring-sky-500 px-4"
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!draft.trim()}
              className="h-10 w-10 rounded-full p-0 bg-sky-600 hover:bg-sky-500 text-white shrink-0 disabled:opacity-30"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StudioView — rendered inside <LiveKitRoom>                         */
/* ------------------------------------------------------------------ */
function StudioView({
  room,
  senderName,
  onEndSession,
}: {
  room: LiveRoom;
  senderName: string;
  onEndSession: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [isPlayingMedia, setIsPlayingMedia] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(room.media_url || "");
  const mediaVideoRef = useRef<HTMLVideoElement>(null);
  const publishedMediaTracksRef = useRef<MediaStreamTrack[]>([]);
  const {
    latestChat,
    pinnedLink,
    setPinnedLink,
    reactions,
    sendReaction,
    stageIdentities,
    setOnStage,
  } = useRoomBroadcast(true);

  // Ensure any playback tracks are unpublished when the studio unmounts
  // (e.g. host closes tab / navigates away) — otherwise they linger on
  // the LiveKit side and eat bandwidth.
  useEffect(() => {
    return () => {
      const tracks = publishedMediaTracksRef.current;
      publishedMediaTracksRef.current = [];
      for (const track of tracks) {
        try {
          localParticipant.unpublishTrack(track);
        } catch {
          /* noop */
        }
        try {
          track.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, [localParticipant]);

  async function toggleCamera() {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error("Camera toggle error:", err);
      toast.error("Could not toggle camera — check browser permissions");
    }
  }

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error("Mic toggle error:", err);
      toast.error("Could not toggle microphone — check browser permissions");
    }
  }

  async function toggleScreen() {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      console.error("Screen share error:", err);
      toast.error("Could not toggle screen share");
    }
  }

  // Play/stop the pre-recorded media attached to this session.
  // Uses video.captureStream() to grab the decoded frames + audio and
  // publishes them into the LiveKit room so every viewer sees playback
  // through the regular broadcast pipeline (no separate URL distribution).
  async function stopMediaPlayback() {
    const video = mediaVideoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        /* noop */
      }
      video.removeAttribute("src");
      video.load();
    }
    // Unpublish any tracks we published for playback
    for (const track of publishedMediaTracksRef.current) {
      try {
        await localParticipant.unpublishTrack(track);
      } catch {
        /* noop */
      }
      try {
        track.stop();
      } catch {
        /* noop */
      }
    }
    publishedMediaTracksRef.current = [];
    setIsPlayingMedia(false);
  }

  async function toggleMedia() {
    if (isPlayingMedia) {
      await stopMediaPlayback();
      return;
    }
    // Validate URL — must be http(s); reject javascript:/data: schemes
    const raw = mediaUrl.trim();
    let safeUrl = "";
    let host = "";
    try {
      const u = new URL(raw);
      if (u.protocol === "http:" || u.protocol === "https:") {
        safeUrl = u.toString();
        host = u.hostname.toLowerCase();
      }
    } catch {
      /* invalid URL */
    }
    if (!safeUrl) {
      toast.error("Enter a valid http(s) video URL");
      return;
    }
    // Hosted-page platforms (YouTube, Vimeo, Facebook, etc.) can't be
    // loaded into a <video> element — they serve HTML pages wrapped in
    // DRM. Tell the host up front and suggest Screen Share instead.
    const hostedPagePatterns = [
      "youtube.com",
      "youtu.be",
      "vimeo.com",
      "facebook.com",
      "fb.watch",
      "twitch.tv",
      "dailymotion.com",
      "tiktok.com",
      "drive.google.com",
    ];
    if (hostedPagePatterns.some((p) => host === p || host.endsWith(`.${p}`))) {
      toast.error(
        `${host} pages can't be played directly. Open the video in a tab and use Screen Share instead, or paste a direct .mp4/.webm URL.`,
        { duration: 7000 },
      );
      return;
    }
    const video = mediaVideoRef.current;
    if (!video) return;

    setMediaLoading(true);
    try {
      video.crossOrigin = "anonymous"; // so captureStream works for cross-origin URLs with CORS
      video.src = safeUrl;
      video.muted = false;

      // Wait for metadata so captureStream returns real tracks
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("error", onError);
          reject(new Error("Failed to load media — check URL or CORS"));
        };
        video.addEventListener("loadedmetadata", onReady);
        video.addEventListener("error", onError);
      });

      await video.play();

      // captureStream() isn't fully typed on HTMLVideoElement in all
      // TS libs — cast narrowly here.
      const stream = (
        video as HTMLVideoElement & { captureStream?: () => MediaStream }
      ).captureStream?.();
      if (!stream) {
        throw new Error("captureStream not supported in this browser");
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        await localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          name: "media-video",
        });
        publishedMediaTracksRef.current.push(videoTrack);
      }
      if (audioTrack) {
        await localParticipant.publishTrack(audioTrack, {
          source: Track.Source.ScreenShareAudio,
          name: "media-audio",
        });
        publishedMediaTracksRef.current.push(audioTrack);
      }

      // Auto-stop when the video finishes
      const onEnded = async () => {
        video.removeEventListener("ended", onEnded);
        await stopMediaPlayback();
        toast.message("Media playback finished");
      };
      video.addEventListener("ended", onEnded);

      setIsPlayingMedia(true);
      toast.success("Playing media to viewers");
    } catch (err: unknown) {
      console.error("Media playback error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to play media",
      );
      await stopMediaPlayback();
    }
    setMediaLoading(false);
  }

  async function toggleRecording() {
    setRecordingLoading(true);
    try {
      const action = isRecording ? "stop" : "start";
      const res = await fetch("/api/livekit/recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, roomId: room.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Failed to ${action} recording`);
      }
      setIsRecording(!isRecording);
      toast.success(isRecording ? "Recording stopped" : "Recording started");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Recording toggle failed",
      );
    }
    setRecordingLoading(false);
  }

  async function handleEnd() {
    setEnding(true);
    try {
      const res = await fetch("/api/livekit/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", roomId: room.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to end session");
      }
      toast.success("Session ended");
      onEndSession();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to end session",
      );
      setEnding(false);
    }
  }

  return (
    <div className="relative flex h-full">
      {/*
        Hidden media player — captureStream() requires the element to
        actually decode frames, so it must stay in the DOM. We move it
        off-screen with position: absolute + visually-hidden styles.
      */}
      <video
        ref={mediaVideoRef}
        playsInline
        className="absolute w-px h-px opacity-0 pointer-events-none"
        style={{ left: "-9999px", top: "-9999px" }}
      />

      {/* Main: Video + Controls */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — dark bar matching the studio, replaces the outer
            host layout header on this route so we don't stack two. */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-800 bg-neutral-900 text-white">
          <div className="flex items-center gap-2 min-w-0 mr-2">
            <Link
              href="/host/live"
              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors shrink-0"
              title="Back to sessions"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sessions</span>
            </Link>
            <span className="text-neutral-600 shrink-0 hidden sm:inline">
              /
            </span>
            <h1 className="font-bold text-sm sm:text-lg truncate min-w-0 text-neutral-100">
              {room.title}
              {room.media_url && (
                <span
                  className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-normal text-neutral-500"
                  title="Pre-recorded media attached"
                >
                  <Film className="h-3 w-3" />
                  Media
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isRecording && (
              <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                <Circle className="h-2.5 w-2.5 fill-red-500 animate-pulse" />
                <span className="hidden sm:inline">REC</span>
              </div>
            )}
            <div className="flex items-center gap-1 sm:gap-1.5 text-sm text-neutral-400">
              <Users className="h-4 w-4" />
              <span>{participants.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors ${
                chatOpen
                  ? "bg-sky-500 text-white shadow-sm hover:bg-sky-600"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
              title={chatOpen ? "Hide chat" : "Show chat"}
              aria-label="Toggle chat"
              aria-pressed={chatOpen}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main video area — fills the whole space, TV-framed stage */}
        <div className="flex-1 bg-gradient-to-b from-neutral-900 to-neutral-950 flex overflow-hidden p-2 sm:p-3">
          <div className="relative w-full h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
            {/* Overlay banner — sits on top of the video, doesn't steal height */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-3 px-3 sm:px-4 py-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold tracking-wider shrink-0">
                  <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
                  LIVE
                </div>
                <span className="text-sm font-medium text-white/90 truncate">
                  {room.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/80 shrink-0">
                <Users className="h-3.5 w-3.5" />
                <span>{participants.length}</span>
              </div>
            </div>

            {/* Screen content */}
            {stageIdentities.size > 0 ? (
              <div className="absolute inset-0 flex">
                <div className="relative w-1/2 flex items-center justify-center border-r border-white/10">
                  <LocalVideoPreview />
                </div>
                <div className="w-1/2">
                  <GuestStage stageIdentities={stageIdentities} />
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <LocalVideoPreview />
              </div>
            )}
            <ReactionLayer reactions={reactions} />
            <NewsTicker latestChat={latestChat} pinnedLink={pinnedLink} />
          </div>
        </div>

        {/* Control bar — Meet-style: dark rail, circular icon buttons.
            `ControlButton` below keeps the on/off/destructive states
            consistent so they read at a glance. */}
        <div className="border-t bg-neutral-950 px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
            <ControlButton
              label="Camera"
              active={isCameraEnabled}
              onClick={toggleCamera}
              icon={isCameraEnabled ? Video : VideoOff}
              danger={!isCameraEnabled}
            />
            <ControlButton
              label="Mic"
              active={isMicrophoneEnabled}
              onClick={toggleMic}
              icon={isMicrophoneEnabled ? Mic : MicOff}
              danger={!isMicrophoneEnabled}
            />
            <ControlButton
              label="Screen"
              active={isScreenShareEnabled}
              onClick={toggleScreen}
              icon={MonitorUp}
            />

            <div className="relative">
              <ControlButton
                label="Media"
                active={isPlayingMedia || mediaPanelOpen}
                onClick={() => setMediaPanelOpen((v) => !v)}
                icon={Film}
                pulse={isPlayingMedia}
              />
              {mediaPanelOpen && (
                <MediaPanel
                  url={mediaUrl}
                  onChange={setMediaUrl}
                  isPlaying={isPlayingMedia}
                  loading={mediaLoading}
                  onTogglePlay={toggleMedia}
                  onClose={() => setMediaPanelOpen(false)}
                />
              )}
            </div>

            <ControlButton
              label={isRecording ? "Stop Rec" : "Record"}
              active={isRecording}
              danger={isRecording}
              loading={recordingLoading}
              onClick={toggleRecording}
              icon={isRecording ? Square : Circle}
            />

            <div className="mx-1 sm:mx-2 self-center">
              <ReactionBar onReact={sendReaction} />
            </div>

            {/* End call — visually separated as a pill, red emphasis */}
            <div className="ml-1 sm:ml-3 pl-2 sm:pl-3 border-l border-white/10 flex items-center">
              <button
                type="button"
                disabled={ending}
                onClick={handleEnd}
                className="group inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-sm shadow-lg shadow-red-900/40 transition-colors disabled:opacity-60"
                aria-label="End session"
              >
                {ending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <PhoneOff className="h-5 w-5" />
                )}
                <span className="hidden sm:inline">End</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Panel — stays mounted so chat history survives toggle.
          Overlay on mobile, sidebar on lg+. Uses `hidden` (display:none)
          instead of conditional rendering so the DataReceived listener
          keeps running in the background. */}
      {chatOpen && (
        <div
          className="absolute inset-0 bg-black/40 z-10 lg:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}
      <div
        className={
          chatOpen
            ? "absolute right-0 top-0 bottom-0 w-[85%] max-w-sm z-20 lg:relative lg:w-80 lg:max-w-none lg:z-auto shrink-0"
            : "hidden"
        }
      >
        <ChatPanel
          senderName={senderName}
          roomName={room.livekit_room_name}
          pinnedLink={pinnedLink}
          onPin={setPinnedLink}
          stageIdentities={stageIdentities}
          onStageToggle={(id, on) =>
            setOnStage(room.livekit_room_name, id, on)
          }
        />
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page component                                                     */
/* ------------------------------------------------------------------ */
export default function HostLiveRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("live_rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (error || !data) {
        toast.error("Room not found");
        router.replace("/host/live");
        return;
      }
      setRoom(data);
      setLoading(false);
    }
    load();
  }, [roomId, router]);

  useEffect(() => {
    if (!room || !profile || token) return;
    async function fetchToken() {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: room!.livekit_room_name,
            identity: profile!.id,
            name: profile!.name,
            isHost: true,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to get token");
        }
        const data = await res.json();
        setToken(data.token);
        setWsUrl(data.wsUrl);
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to connect to room",
        );
        router.replace("/host/live");
      }
    }
    fetchToken();
  }, [room, profile, token, router]);

  if (authLoading || loading || !room || !token || !wsUrl) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Connecting to studio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)]">
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect={true}
        video={false}
        audio={false}
        className="h-full"
      >
        <StudioView
          room={room}
          senderName={profile?.name || "Host"}
          onEndSession={() => router.replace("/host/live")}
        />
      </LiveKitRoom>
    </div>
  );
}
