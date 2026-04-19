import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { requireAdmin } from "@/lib/auth-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getConfig() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "livekit_config")
    .maybeSingle();

  let apiKey = process.env.LIVEKIT_API_KEY || "";
  let apiSecret = process.env.LIVEKIT_API_SECRET || "";
  let wsUrl = process.env.LIVEKIT_WS_URL || "";

  if (setting?.value) {
    const cfg =
      typeof setting.value === "string"
        ? JSON.parse(setting.value)
        : setting.value;
    apiKey = cfg.api_key || apiKey;
    apiSecret = cfg.api_secret || apiSecret;
    wsUrl = cfg.ws_url || wsUrl;
  }

  return { supabase, apiKey, apiSecret, wsUrl };
}

function getRoomService(apiKey: string, apiSecret: string, wsUrl: string) {
  let httpUrl = wsUrl;
  if (httpUrl.startsWith("wss://"))
    httpUrl = httpUrl.replace("wss://", "https://");
  else if (httpUrl.startsWith("ws://"))
    httpUrl = httpUrl.replace("ws://", "http://");
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { action, roomName } = body as {
      action: string;
      roomName: string;
    };

    if (!action || !roomName) {
      return NextResponse.json(
        { error: "action and roomName are required" },
        { status: 400 },
      );
    }

    const { apiKey, apiSecret, wsUrl } = await getConfig();
    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 500 },
      );
    }

    const roomService = getRoomService(apiKey, apiSecret, wsUrl);

    /* ---- List participants ---- */
    if (action === "list") {
      const participants = await roomService.listParticipants(roomName);
      const list = participants.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        joinedAt: p.joinedAt ? Number(p.joinedAt) : 0,
        tracks: (p.tracks || []).map((t) => ({
          sid: t.sid,
          source: t.source,
          type: t.type,
          muted: t.muted,
        })),
        permission: p.permission,
      }));
      return NextResponse.json({ participants: list });
    }

    /* ---- Mute / unmute a participant's track ---- */
    if (action === "mute" || action === "unmute") {
      const { identity, trackSid } = body as {
        identity: string;
        trackSid: string;
      };
      if (!identity || !trackSid) {
        return NextResponse.json(
          { error: "identity and trackSid are required" },
          { status: 400 },
        );
      }
      const muted = action === "mute";
      await roomService.mutePublishedTrack(
        roomName,
        identity,
        trackSid,
        muted,
      );
      return NextResponse.json({ ok: true, muted });
    }

    /* ---- Mute all audio tracks for a participant ---- */
    if (action === "muteAll" || action === "unmuteAll") {
      const { identity } = body as { identity: string };
      if (!identity) {
        return NextResponse.json(
          { error: "identity is required" },
          { status: 400 },
        );
      }
      const participants = await roomService.listParticipants(roomName);
      const participant = participants.find((p) => p.identity === identity);
      if (!participant) {
        return NextResponse.json(
          { error: "Participant not found" },
          { status: 404 },
        );
      }
      const muted = action === "muteAll";
      const audioTracks = (participant.tracks || []).filter(
        (t) => t.type === 1 /* AUDIO */,
      );
      for (const track of audioTracks) {
        await roomService.mutePublishedTrack(
          roomName,
          identity,
          track.sid,
          muted,
        );
      }
      return NextResponse.json({
        ok: true,
        muted,
        tracksAffected: audioTracks.length,
      });
    }

    /* ---- Remove (kick) participant ---- */
    if (action === "remove") {
      const { identity } = body as { identity: string };
      if (!identity) {
        return NextResponse.json(
          { error: "identity is required" },
          { status: 400 },
        );
      }
      await roomService.removeParticipant(roomName, identity);
      return NextResponse.json({ ok: true });
    }

    /* ---- Invite to / remove from stage (grant or revoke canPublish) ---- */
    if (action === "inviteToStage" || action === "removeFromStage") {
      const { identity } = body as { identity: string };
      if (!identity) {
        return NextResponse.json(
          { error: "identity is required" },
          { status: 400 },
        );
      }
      const grant = action === "inviteToStage";

      // Read current participant so we preserve other permission flags.
      const participants = await roomService.listParticipants(roomName);
      const target = participants.find((p) => p.identity === identity);
      if (!target) {
        return NextResponse.json(
          { error: "Participant not found" },
          { status: 404 },
        );
      }
      const current = target.permission;

      await roomService.updateParticipant(roomName, identity, {
        permission: {
          canSubscribe: current?.canSubscribe ?? true,
          canPublish: grant,
          canPublishData: current?.canPublishData ?? true,
          canPublishSources: current?.canPublishSources ?? [],
          hidden: current?.hidden ?? false,
          recorder: current?.recorder ?? false,
          canUpdateMetadata: current?.canUpdateMetadata ?? false,
          canSubscribeMetrics: current?.canSubscribeMetrics ?? false,
          agent: current?.agent ?? false,
        },
      });

      // When revoking, also un-publish any tracks they had up so they
      // disappear from everyone's grid immediately instead of after
      // the client-side permission push.
      if (!grant) {
        const publishedTracks = target.tracks || [];
        for (const t of publishedTracks) {
          try {
            await roomService.mutePublishedTrack(
              roomName,
              identity,
              t.sid,
              true,
            );
          } catch {
            /* track might already be gone */
          }
        }
      }

      return NextResponse.json({ ok: true, onStage: grant });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("LiveKit participant error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
