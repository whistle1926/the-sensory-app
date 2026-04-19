import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomName, identity, name, isHost } = body as {
      roomName: string;
      identity: string;
      name?: string;
      isHost?: boolean;
    };

    if (!roomName || !identity) {
      return NextResponse.json(
        { error: "roomName and identity are required" },
        { status: 400 },
      );
    }

    // Load LiveKit config from settings
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

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 500 },
      );
    }

    // Log config for debugging (redact secret)
    console.log("LiveKit token config:", {
      apiKey,
      apiSecretLength: apiSecret.length,
      apiSecretFirst4: apiSecret.slice(0, 4),
      wsUrl,
      roomName,
    });

    // Look up the room to determine mode
    const { data: room } = await supabase
      .from("live_rooms")
      .select("mode, status, require_auth")
      .eq("livekit_room_name", roomName)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Determine grants based on role and mode
    const canPublish =
      isHost || room.mode === "interactive";

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name || identity,
      ttl: "6h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    // Ensure wsUrl uses wss:// protocol (LiveKit client needs WebSocket, not HTTPS)
    let clientWsUrl = wsUrl;
    if (clientWsUrl.startsWith("https://")) {
      clientWsUrl = clientWsUrl.replace("https://", "wss://");
    } else if (clientWsUrl.startsWith("http://")) {
      clientWsUrl = clientWsUrl.replace("http://", "ws://");
    } else if (!clientWsUrl.startsWith("wss://") && !clientWsUrl.startsWith("ws://")) {
      clientWsUrl = `wss://${clientWsUrl}`;
    }

    return NextResponse.json({ token: jwt, wsUrl: clientWsUrl });
  } catch (err) {
    console.error("LiveKit token error:", err);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 },
    );
  }
}
