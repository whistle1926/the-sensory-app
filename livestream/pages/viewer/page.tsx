"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2,
  Clock,
  VideoOff,
  MessageCircle,
  Send,
  Pin,
  ExternalLink,
  Radio,
  Maximize2,
  LayoutGrid,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  LiveKitRoom,
  VideoTrack,
  TrackToggle,
  useTracks,
  useRoomContext,
  useLocalParticipant,
  RoomAudioRenderer,
  isTrackReference,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-core";
import "@livekit/components-styles";
import { Track, RoomEvent } from "livekit-client";
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
  offset: number;
}

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "🙌", "😂"];

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
/* useViewerBroadcast — listen for chat + pin + stage over data channel */
/* ------------------------------------------------------------------ */
function useViewerBroadcast() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [latestChat, setLatestChat] = useState<LatestChat | null>(null);
  const [pinnedLink, setPinnedLink] = useState<PinnedLink | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [stageIdentities, setStageIdentities] = useState<Set<string>>(
    new Set(),
  );
  const [onStage, setOnStage] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const onStageRef = useRef(false);

  const addReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const offset = 5 + Math.random() * 70;
    setReactions((prev) => [...prev, { id, emoji, offset }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const decoder = new TextDecoder();
    const handleData = (
      payload: Uint8Array,
      participant:
        | {
            identity: string;
            name?: string;
            permissions?: { canPublish?: boolean };
          }
        | undefined,
    ) => {
      try {
        const parsed = JSON.parse(decoder.decode(payload));
        // Only trust authoritative control messages (pin, stage) from
        // a sender with publish permission — i.e., the host. Prevents a
        // viewer from spoofing stage invites or pinned links.
        const senderCanPublish = participant?.permissions?.canPublish === true;
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
          if (!senderCanPublish) return;
          if (parsed.cleared) {
            setPinnedLink(null);
          } else if (parsed.url && typeof parsed.url === "string") {
            const safeUrl = normalizeUrl(parsed.url);
            if (safeUrl) {
              setPinnedLink({
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
          if (!senderCanPublish) return;
          const ids: string[] = Array.isArray(parsed.identities)
            ? parsed.identities.filter((x: unknown) => typeof x === "string")
            : [];
          const nextSet = new Set(ids);
          setStageIdentities(nextSet);
          const selfIdentity = localParticipant?.identity;
          if (selfIdentity) {
            const nowOnStage = nextSet.has(selfIdentity);
            if (nowOnStage && !onStageRef.current) {
              setInvitePending(true);
            } else if (!nowOnStage && onStageRef.current) {
              // Host removed us — turn off devices + inform
              onStageRef.current = false;
              setOnStage(false);
              setInvitePending(false);
              try {
                localParticipant.setCameraEnabled(false);
                localParticipant.setMicrophoneEnabled(false);
              } catch {
                /* ignore */
              }
              toast.info("You've been taken off stage.");
            }
          }
        }
      } catch {
        // ignore
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, addReaction, localParticipant]);

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!REACTION_EMOJIS.includes(emoji)) return;
      addReaction(emoji);
      try {
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(
          encoder.encode(JSON.stringify({ type: "reaction", emoji })),
          { reliable: false },
        );
      } catch {
        // silent
      }
    },
    [room, addReaction],
  );

  const acceptStage = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(true);
      await localParticipant.setMicrophoneEnabled(true);
      onStageRef.current = true;
      setOnStage(true);
      setInvitePending(false);
      toast.success("You're live on stage.");
    } catch (err) {
      console.error("Failed to go on stage:", err);
      toast.error("Could not enable camera/mic.");
    }
  }, [localParticipant]);

  const declineStage = useCallback(() => {
    setInvitePending(false);
  }, []);

  return {
    latestChat,
    pinnedLink,
    reactions,
    sendReaction,
    stageIdentities,
    onStage,
    invitePending,
    acceptStage,
    declineStage,
  };
}

/* ------------------------------------------------------------------ */
/* NewsTicker — pinned link + scrolling latest chat overlay           */
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
/* ReactionLayer — floating emojis over video                         */
/* ------------------------------------------------------------------ */
function ReactionLayer({ reactions }: { reactions: FloatingReaction[] }) {
  // Zoom-style: reactions float up from bottom-left in a narrow column.
  // Each reaction gets a slight horizontal jitter for organic feel but
  // stays confined to the left edge so it doesn't cover the video content.
  return (
    <div className="absolute left-3 sm:left-5 bottom-12 w-16 pointer-events-none overflow-visible z-20">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-0 text-2xl sm:text-3xl reaction-float"
          style={{ left: `${(r.offset % 40)}px` }}
        >
          {r.emoji}
        </span>
      ))}
      <style jsx>{`
        .reaction-float {
          animation: reaction-rise 2.8s ease-out forwards;
        }
        @keyframes reaction-rise {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          10% {
            transform: translateY(-10px) scale(1);
            opacity: 1;
          }
          80% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-220px) scale(0.85);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ReactionBar — tap an emoji to broadcast a reaction                 */
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
      className={`flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-1 shadow-lg ${className ?? ""}`}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-white/15 active:scale-90 transition-all text-lg sm:text-xl flex items-center justify-center"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RemoteStage — renders the host's tracks with a focus/grid toggle   */
/* When there's a screen share, it takes over the full stage and any  */
/* camera tracks shrink to PiP in the corner. A toggle flips to grid. */
/* ------------------------------------------------------------------ */
// VideoTrack only accepts TrackReference (not Placeholder), so narrow
// using LiveKit's own type guard.
function RemoteStage({
  remoteTracks,
  tickerOffset,
}: {
  remoteTracks: ReturnType<typeof useTracks>;
  tickerOffset: boolean;
}) {
  // isTrackReference is a type predicate but Array.filter doesn't pick up
  // the narrowing when the guard's input is `unknown`; use a local typed
  // predicate to keep narrowing explicit.
  const concreteTracks: TrackReference[] = remoteTracks.flatMap((t) =>
    isTrackReference(t) ? [t as TrackReference] : [],
  );
  // "auto" = focus screen share when present, grid otherwise. The viewer
  // can override with the toggle button to force grid even when a screen
  // share is active.
  const [mode, setMode] = useState<"auto" | "grid">("auto");

  const screenShare = concreteTracks.find(
    (t) => t.source === Track.Source.ScreenShare,
  );
  const cameras = concreteTracks.filter(
    (t) => t.source === Track.Source.Camera,
  );

  // When no screen share, nothing to focus — just lay out cameras.
  if (!screenShare) {
    const gridCols = cameras.length >= 2 ? "grid-cols-2" : "grid-cols-1";
    return (
      <div className={`w-full h-full grid ${gridCols} gap-1`}>
        {cameras.map((trackRef) => (
          <VideoTrack
            key={trackRef.publication.trackSid}
            trackRef={trackRef}
            className="w-full h-full object-contain"
          />
        ))}
      </div>
    );
  }

  const isFocus = mode === "auto";

  return (
    <>
      {/* Focus / grid toggle — top-left over the video */}
      <button
        type="button"
        onClick={() => setMode(isFocus ? "grid" : "auto")}
        className="absolute top-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 backdrop-blur transition-colors"
        title={isFocus ? "Switch to grid view" : "Focus screen share"}
      >
        {isFocus ? (
          <>
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Grid view</span>
          </>
        ) : (
          <>
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Focus share</span>
          </>
        )}
      </button>

      {isFocus ? (
        <>
          {/* Screen share fills the stage */}
          <VideoTrack
            trackRef={screenShare}
            className="w-full h-full object-contain"
          />
          {/* Cameras stack as PiPs in the top-right (below reaction bar) */}
          <div
            className={`absolute right-2 sm:right-4 flex flex-col gap-2 z-20 ${
              tickerOffset ? "bottom-14 sm:bottom-16" : "bottom-2 sm:bottom-4"
            }`}
          >
            {cameras.map((trackRef) => (
              <div
                key={trackRef.publication.trackSid}
                className="w-28 h-20 sm:w-48 sm:h-32 rounded-lg overflow-hidden border-2 border-white/30 shadow-xl bg-black"
              >
                <VideoTrack
                  trackRef={trackRef}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          className={`w-full h-full grid ${
            concreteTracks.length >= 2 ? "grid-cols-2" : "grid-cols-1"
          } gap-1`}
        >
          {concreteTracks.map((trackRef) => (
            <VideoTrack
              key={trackRef.publication.trackSid}
              trackRef={trackRef}
              className="w-full h-full object-contain"
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* StageInvitePrompt — modal when host invites this viewer on stage    */
/* ------------------------------------------------------------------ */
function StageInvitePrompt({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-background rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center gap-2 text-red-500">
          <Radio className="h-5 w-5 animate-pulse" />
          <span className="font-semibold">You&apos;ve been invited on stage</span>
        </div>
        <p className="text-sm text-muted-foreground">
          The host wants you to join on camera beside them. Your camera and
          microphone will be shared with everyone watching.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onDecline}>
            Not now
          </Button>
          <Button size="sm" onClick={onAccept}>
            <Radio className="h-4 w-4 mr-2" />
            Go Live
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ViewerChatPanel — uses LiveKit data messages for real-time chat     */
/* ------------------------------------------------------------------ */
function ViewerChatPanel({ senderName }: { senderName: string }) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify({ type: "chat", sender: senderName, text }),
    );
    try {
      await room.localParticipant.publishData(data, { reliable: true });
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

  // Deterministic avatar colour per sender
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
    for (let i = 0; i < name.length; i++)
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  };
  const initialOf = (name: string) =>
    name.trim().charAt(0).toUpperCase() || "?";

  // Colour per sender — deterministic from name hash
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 font-semibold text-sm flex items-center gap-2 text-neutral-300">
        <MessageCircle className="h-4 w-4 text-neutral-500" />
        Live Chat
      </div>

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
          <div key={msg.id} className="flex items-start gap-2 py-1 px-1 rounded hover:bg-white/5 group">
            <div
              className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5 ${avatarFor(msg.sender)}`}
              aria-hidden
            >
              {initialOf(msg.sender)}
            </div>
            <p className="text-sm leading-relaxed min-w-0">
              <span className={`font-semibold mr-1.5 ${msg.isLocal ? "text-sky-400" : nameColor(msg.sender)}`}>
                {msg.isLocal ? "You" : msg.sender}
              </span>
              <span className="text-neutral-200 break-words">{msg.text}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-neutral-800 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BroadcastViewer — watch-only, shows remote tracks                  */
/* ------------------------------------------------------------------ */
function BroadcastViewer({
  senderName,
  onLeave,
  brandingTitle,
  brandingLogo,
}: {
  senderName: string;
  onLeave: () => void;
  brandingTitle: string;
  brandingLogo: string;
}) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const remoteTracks = tracks.filter((t) => !t.participant.isLocal);
  const localCamera = tracks.find(
    (t) =>
      t.participant.isLocal &&
      t.source === Track.Source.Camera &&
      t.publication?.track,
  );
  const [chatOpen, setChatOpen] = useState(false);
  const {
    latestChat,
    pinnedLink,
    reactions,
    sendReaction,
    onStage,
    invitePending,
    acceptStage,
    declineStage,
  } = useViewerBroadcast();

  const tickerOffset = Boolean(latestChat || pinnedLink);

  return (
    <div className="relative flex h-full bg-neutral-950">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-800 bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            {brandingLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandingLogo}
                alt=""
                className="h-7 w-auto object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <span className="font-bold text-sm sm:text-base truncate">
              {brandingTitle}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 shrink-0">
              <Radio className="h-2.5 w-2.5 fill-red-400" />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                chatOpen
                  ? "bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
              title={chatOpen ? "Hide chat" : "Show chat"}
              aria-label="Toggle chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Theater-style video — matches host studio padding */}
        <div className="flex-1 bg-gradient-to-b from-neutral-900 to-neutral-950 flex overflow-hidden p-2 sm:p-3">
          <div className="relative w-full h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
            {remoteTracks.length > 0 ? (
              <RemoteStage
                remoteTracks={remoteTracks}
                tickerOffset={tickerOffset}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-white/50 text-sm flex flex-col items-center gap-2">
                  <VideoOff className="h-8 w-8" />
                  <span className="text-center px-4">Waiting for the host to share video...</span>
                </div>
              </div>
            )}

            {/* Local camera PiP when on stage */}
            {onStage && localCamera?.publication?.track && (
              <div
                className={`absolute right-2 w-28 h-20 sm:right-4 sm:w-48 sm:h-36 rounded-lg overflow-hidden border-2 border-red-500 shadow-lg ${
                  latestChat || pinnedLink
                    ? "bottom-12 sm:bottom-14"
                    : "bottom-2 sm:bottom-4"
                }`}
              >
                <VideoTrack
                  trackRef={localCamera}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Radio className="h-2.5 w-2.5" />
                  LIVE
                </div>
              </div>
            )}

            {/* Reactions float from bottom-left (Zoom-style) */}
            <ReactionLayer reactions={reactions} />
            <NewsTicker latestChat={latestChat} pinnedLink={pinnedLink} />
            <StageInvitePrompt
              open={invitePending}
              onAccept={acceptStage}
              onDecline={declineStage}
            />
          </div>
        </div>

        {/* Bottom bar — matches host control bar height so video aligns */}
        <div className="border-t border-neutral-800 bg-neutral-950 px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            <ReactionBar onReact={sendReaction} className="bg-neutral-800/80" />

            <div className="ml-1 sm:ml-3 pl-2 sm:pl-3 border-l border-white/10 flex items-center">
              <button
                type="button"
                onClick={onLeave}
                className="group inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-sm shadow-lg shadow-red-900/40 transition-colors"
                aria-label="Leave session"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </div>

        <RoomAudioRenderer />
      </div>

      {/* Chat sidebar */}
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
        <ViewerChatPanel senderName={senderName} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* InteractiveViewer — can publish camera/mic, sees remote tracks      */
/* ------------------------------------------------------------------ */
function InteractiveViewer({
  senderName,
  onLeave,
  brandingTitle,
  brandingLogo,
}: {
  senderName: string;
  onLeave: () => void;
  brandingTitle: string;
  brandingLogo: string;
}) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const remoteTracks = tracks.filter((t) => !t.participant.isLocal);
  const localCamera = tracks.find(
    (t) =>
      t.participant.isLocal &&
      t.source === Track.Source.Camera &&
      t.publication?.track,
  );
  const [chatOpen, setChatOpen] = useState(false);
  const {
    latestChat,
    pinnedLink,
    reactions,
    sendReaction,
    invitePending,
    acceptStage,
    declineStage,
  } = useViewerBroadcast();

  const tickerOffset = Boolean(latestChat || pinnedLink);

  return (
    <div className="relative flex h-full bg-neutral-950">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-800 bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            {brandingLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandingLogo}
                alt=""
                className="h-7 w-auto object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <span className="font-bold text-sm sm:text-base truncate">
              {brandingTitle}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 shrink-0">
              <Radio className="h-2.5 w-2.5 fill-red-400" />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                chatOpen
                  ? "bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
              title={chatOpen ? "Hide chat" : "Show chat"}
              aria-label="Toggle chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Theater-style video — matches host studio */}
        <div className="flex-1 bg-gradient-to-b from-neutral-900 to-neutral-950 flex overflow-hidden p-2 sm:p-3">
          <div className="relative w-full h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
            <div className="w-full h-full flex items-center justify-center">
              {remoteTracks.length > 0 ? (
                <RemoteStage
                  remoteTracks={remoteTracks}
                  tickerOffset={tickerOffset}
                />
              ) : (
                <div className="text-white/50 text-sm flex flex-col items-center gap-2">
                  <VideoOff className="h-8 w-8" />
                  Waiting for the host...
                </div>
              )}
            </div>

            {/* Local camera PiP */}
            {localCamera?.publication?.track && (
              <div
                className={`absolute right-2 w-28 h-20 sm:right-4 sm:w-48 sm:h-36 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg ${
                  latestChat || pinnedLink
                    ? "bottom-12 sm:bottom-14"
                    : "bottom-2 sm:bottom-4"
                }`}
              >
                <VideoTrack
                  trackRef={localCamera}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <ReactionLayer reactions={reactions} />
            <NewsTicker latestChat={latestChat} pinnedLink={pinnedLink} />
            <StageInvitePrompt
              open={invitePending}
              onAccept={acceptStage}
              onDecline={declineStage}
            />
          </div>
        </div>

        {/* Bottom bar — cam/mic toggles + reactions + leave, aligned to host bar */}
        <div className="border-t border-neutral-800 bg-neutral-950 px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            <TrackToggle source={Track.Source.Camera} />
            <TrackToggle source={Track.Source.Microphone} />

            <div className="mx-1 sm:mx-2">
              <ReactionBar onReact={sendReaction} className="bg-neutral-800/80" />
            </div>

            <div className="ml-1 sm:ml-3 pl-2 sm:pl-3 border-l border-white/10 flex items-center">
              <button
                type="button"
                onClick={onLeave}
                className="group inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-sm shadow-lg shadow-red-900/40 transition-colors"
                aria-label="Leave session"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </div>

        <RoomAudioRenderer />
      </div>

      {/* Chat sidebar */}
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
        <ViewerChatPanel senderName={senderName} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */
export default function LiveViewerPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerName, setViewerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [left, setLeft] = useState(false);

  const handleLeave = () => {
    setJoined(false);
    setToken(null);
    setWsUrl(null);
    setLeft(true);
  };

  const handleRejoin = () => {
    setLeft(false);
  };

  // Per-session branding — admins can set a custom title/logo so the page
  // works for tutoring calls, guest speakers, or partner-branded events.
  const brandingTitle =
    (room?.branding_title && room.branding_title.trim()) || "Live Stream";
  const brandingLogo =
    (room?.branding_logo_url && room.branding_logo_url.trim()) || "";

  useEffect(() => {
    if (brandingTitle) document.title = brandingTitle;
  }, [brandingTitle]);

  const Header = () => (
    <header className="border-b bg-background px-4 py-3 flex items-center gap-3 h-14">
      {brandingLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brandingLogo}
          alt=""
          className="h-8 w-auto object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <span className="font-bold text-lg truncate">{brandingTitle}</span>
    </header>
  );

  const withShell = (children: React.ReactNode) => (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );

  // Fetch room
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("live_rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (error || !data) {
        toast.error("Session not found");
        setLoading(false);
        return;
      }
      setRoom(data);
      setLoading(false);
    }
    load();
  }, [roomId]);

  // Poll for status changes (scheduled -> live)
  useEffect(() => {
    if (!room || room.status !== "scheduled") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("status")
        .eq("id", roomId)
        .single();
      if (data && data.status !== room.status) {
        setRoom((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [room, roomId]);

  async function handleJoin() {
    if (!viewerName.trim() || !room) return;
    setJoining(true);
    try {
      const identity = `viewer-${crypto.randomUUID().slice(0, 8)}`;
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: room.livekit_room_name,
          identity,
          name: viewerName.trim(),
          isHost: false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to join session");
      }
      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setJoined(true);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to join session",
      );
    }
    setJoining(false);
  }

  if (loading) {
    return withShell(
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>,
    );
  }

  if (!room) {
    return withShell(
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Session not found.</p>
      </div>,
    );
  }

  /* ---- Ended ---- */
  if (room.status === "ended" || room.status === "cancelled") {
    return withShell(
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-3">
            <VideoOff className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Session has ended</h2>
            <p className="text-muted-foreground">
              This live session is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>,
    );
  }

  /* ---- Scheduled (waiting) ---- */
  if (room.status === "scheduled") {
    return withShell(
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-3">
            <Clock className="h-10 w-10 mx-auto text-blue-500" />
            <h2 className="text-xl font-semibold">{room.title}</h2>
            <p className="text-muted-foreground">
              This session hasn&apos;t started yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Scheduled for{" "}
              {new Date(room.scheduled_start).toLocaleDateString()}{" "}
              at{" "}
              {new Date(room.scheduled_start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              This page will update automatically when the session goes live.
            </p>
          </CardContent>
        </Card>
      </div>,
    );
  }

  /* ---- Viewer left the session ---- */
  if (left) {
    return withShell(
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-4">
            <LogOut className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">You&apos;ve left the session</h2>
            <p className="text-muted-foreground text-sm">
              {room.title}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleRejoin}>Rejoin</Button>
            </div>
          </CardContent>
        </Card>
      </div>,
    );
  }

  /* ---- Live: pre-join (enter name) ---- */
  if (!joined || !token || !wsUrl) {
    return withShell(
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-8 space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold">{room.title}</h2>
              <p className="text-sm text-muted-foreground">
                Enter your name to join this live session
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Your name"
                value={viewerName}
                onChange={(e) => setViewerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              />
              <Button
                className="w-full"
                disabled={!viewerName.trim() || joining}
                onClick={handleJoin}
              >
                {joining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Join Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>,
    );
  }

  /* ---- Live: connected ---- */
  const isBroadcast = room.mode === "broadcast";

  // Branding is now embedded in the viewer header (one merged bar),
  // so no outer <Header /> needed — avoids the double-header problem.
  return (
    <div className="h-screen">
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect={true}
        video={!isBroadcast}
        audio={!isBroadcast}
        className="h-full flex flex-col"
      >
        {isBroadcast ? (
          <BroadcastViewer
            senderName={viewerName}
            onLeave={handleLeave}
            brandingTitle={brandingTitle}
            brandingLogo={brandingLogo}
          />
        ) : (
          <InteractiveViewer
            senderName={viewerName}
            onLeave={handleLeave}
            brandingTitle={brandingTitle}
            brandingLogo={brandingLogo}
          />
        )}
      </LiveKitRoom>
    </div>
  );
}
