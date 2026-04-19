import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { requireAdmin } from "@/lib/auth-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabaseAndConfig() {
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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    const { supabase, apiKey, apiSecret, wsUrl } = await getSupabaseAndConfig();

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 500 },
      );
    }

    // RoomServiceClient needs https:// URL
    let httpUrl = wsUrl;
    if (httpUrl.startsWith("wss://")) httpUrl = httpUrl.replace("wss://", "https://");
    else if (httpUrl.startsWith("ws://")) httpUrl = httpUrl.replace("ws://", "http://");

    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

    if (action === "create") {
      const {
        title,
        description,
        mode,
        scheduled_start,
        scheduled_end,
        coach_id,
        school_id,
        max_participants,
        require_auth,
        notes,
        media_url,
        branding_title,
        branding_logo_url,
      } = body;

      if (!title || !scheduled_start) {
        return NextResponse.json(
          { error: "title and scheduled_start required" },
          { status: 400 },
        );
      }

      // Generate a URL-safe room name
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const roomName = `${slug}-${Date.now()}`;

      // Validate media_url is http(s) if present — no javascript:/data: URLs
      let safeMediaUrl = "";
      if (typeof media_url === "string" && media_url.trim()) {
        try {
          const u = new URL(media_url.trim());
          if (u.protocol === "http:" || u.protocol === "https:") {
            safeMediaUrl = u.toString();
          }
        } catch {
          // leave as empty
        }
      }

      // Validate branding logo URL similarly (cannot be javascript:/data:)
      let safeLogoUrl = "";
      if (typeof branding_logo_url === "string" && branding_logo_url.trim()) {
        try {
          const u = new URL(branding_logo_url.trim());
          if (u.protocol === "http:" || u.protocol === "https:") {
            safeLogoUrl = u.toString();
          }
        } catch {
          // leave as empty
        }
      }

      // Bound branding_title to avoid giant strings in the page header
      const safeBrandingTitle =
        typeof branding_title === "string"
          ? branding_title.trim().slice(0, 120)
          : "";

      // Insert DB record. media_url is optional — only include if set so
      // this keeps working before the live_session_media migration lands.
      const insertRow: Record<string, unknown> = {
        title,
        description: description || "",
        mode: mode || "broadcast",
        scheduled_start,
        scheduled_end: scheduled_end || null,
        coach_id: coach_id || null,
        school_id: school_id || null,
        livekit_room_name: roomName,
        max_participants: max_participants || 100,
        require_auth: require_auth ?? false,
        notes: notes || "",
      };
      if (safeMediaUrl) insertRow.media_url = safeMediaUrl;
      if (safeBrandingTitle) insertRow.branding_title = safeBrandingTitle;
      if (safeLogoUrl) insertRow.branding_logo_url = safeLogoUrl;

      // If a newly-added column doesn't exist yet on the remote (migration
      // not applied), strip the offending key(s) and retry so the admin
      // can still create the session. Postgres usually reports one column
      // per error, so loop until the insert succeeds or fails for a
      // non-schema reason.
      const OPTIONAL_COLUMNS = [
        "media_url",
        "branding_title",
        "branding_logo_url",
      ];
      const stripped: string[] = [];

      let room = null;
      let error = null;
      for (let attempt = 0; attempt < OPTIONAL_COLUMNS.length + 1; attempt++) {
        const res = await supabase
          .from("live_rooms")
          .insert(insertRow)
          .select()
          .single();
        room = res.data;
        error = res.error;
        if (!error) break;
        const msg = error.message || "";
        if (!/column|schema/i.test(msg)) break;
        let didStrip = false;
        for (const col of OPTIONAL_COLUMNS) {
          if (new RegExp(col, "i").test(msg) && col in insertRow) {
            delete insertRow[col];
            stripped.push(col);
            didStrip = true;
          }
        }
        if (!didStrip) break;
      }

      if (error) {
        console.error("live_rooms insert error:", error);
        return NextResponse.json(
          {
            error: "Failed to create room",
            detail: error.message || String(error),
          },
          { status: 500 },
        );
      }

      // Tell the client which fields were dropped so the admin can be
      // warned to apply the outstanding migration instead of guessing
      // why branding silently didn't save.
      return NextResponse.json({ room, stripped });
    }

    if (action === "start") {
      const { roomId } = body;
      if (!roomId) {
        return NextResponse.json(
          { error: "roomId required" },
          { status: 400 },
        );
      }

      // Get room to get the livekit_room_name
      const { data: room } = await supabase
        .from("live_rooms")
        .select("livekit_room_name")
        .eq("id", roomId)
        .single();

      if (!room) {
        return NextResponse.json(
          { error: "Room not found" },
          { status: 404 },
        );
      }

      // Create the LiveKit room
      try {
        await roomService.createRoom({
          name: room.livekit_room_name,
          emptyTimeout: 300,
          maxParticipants: 100,
        });
      } catch {
        // Room may already exist, that's ok
      }

      // Update DB status
      await supabase
        .from("live_rooms")
        .update({ status: "live", actual_start: new Date().toISOString() })
        .eq("id", roomId);

      return NextResponse.json({ ok: true });
    }

    if (action === "end") {
      const { roomId } = body;
      if (!roomId) {
        return NextResponse.json(
          { error: "roomId required" },
          { status: 400 },
        );
      }

      const { data: room } = await supabase
        .from("live_rooms")
        .select("livekit_room_name")
        .eq("id", roomId)
        .single();

      if (room) {
        try {
          await roomService.deleteRoom(room.livekit_room_name);
        } catch {
          // Room may already be gone
        }
      }

      await supabase
        .from("live_rooms")
        .update({ status: "ended", actual_end: new Date().toISOString() })
        .eq("id", roomId);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("LiveKit room error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
