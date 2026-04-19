import { NextResponse } from "next/server";
import { EgressClient, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";
import { S3Upload } from "@livekit/protocol";
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
    const { action, roomId } = body as { action: string; roomId: string };

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId required" },
        { status: 400 },
      );
    }

    const { supabase, apiKey, apiSecret, wsUrl } = await getSupabaseAndConfig();

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 500 },
      );
    }

    // EgressClient needs https:// URL
    let httpUrl = wsUrl;
    if (httpUrl.startsWith("wss://")) httpUrl = httpUrl.replace("wss://", "https://");
    else if (httpUrl.startsWith("ws://")) httpUrl = httpUrl.replace("ws://", "http://");

    const egressClient = new EgressClient(httpUrl, apiKey, apiSecret);

    const { data: room } = await supabase
      .from("live_rooms")
      .select("livekit_room_name")
      .eq("id", roomId)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (action === "start") {
      // Start a room composite egress — save to an S3-compatible bucket.
      // Supabase Storage exposes an S3 endpoint so the easiest path is to
      // point this at your project's storage — but any S3-compatible bucket
      // (AWS S3, Cloudflare R2, MinIO, Backblaze B2) works too.
      //
      // Configure via env vars:
      //   RECORDING_S3_ACCESS_KEY
      //   RECORDING_S3_SECRET_KEY
      //   RECORDING_S3_ENDPOINT      (e.g. https://<project>.supabase.co/storage/v1/s3)
      //   RECORDING_S3_REGION        (e.g. eu-west-3)
      //   RECORDING_S3_BUCKET        (e.g. recordings)
      //   RECORDING_S3_FORCE_PATH_STYLE (optional, "true" for Supabase/MinIO)
      const s3AccessKey = process.env.RECORDING_S3_ACCESS_KEY || "";
      const s3Secret = process.env.RECORDING_S3_SECRET_KEY || "";
      const s3Endpoint = process.env.RECORDING_S3_ENDPOINT || "";
      const s3Region = process.env.RECORDING_S3_REGION || "";
      const s3Bucket = process.env.RECORDING_S3_BUCKET || "recordings";
      const s3ForcePathStyle =
        (process.env.RECORDING_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true";

      if (!s3AccessKey || !s3Secret || !s3Endpoint || !s3Region) {
        return NextResponse.json(
          {
            error:
              "Recording storage not configured (set RECORDING_S3_* env vars)",
          },
          { status: 500 },
        );
      }

      const s3 = new S3Upload({
        accessKey: s3AccessKey,
        secret: s3Secret,
        endpoint: s3Endpoint,
        region: s3Region,
        bucket: s3Bucket,
        forcePathStyle: s3ForcePathStyle,
      });

      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `${room.livekit_room_name}-{time}.mp4`,
        output: { case: "s3", value: s3 },
      });

      let egress;
      try {
        egress = await egressClient.startRoomCompositeEgress(
          room.livekit_room_name,
          { file: output },
        );
      } catch (egressErr: unknown) {
        const msg = egressErr instanceof Error ? egressErr.message : String(egressErr);
        console.error("Egress start failed:", msg);
        return NextResponse.json(
          { error: `Recording failed: ${msg}` },
          { status: 500 },
        );
      }

      // Insert recording row
      const { data: recording, error } = await supabase
        .from("live_recordings")
        .insert({
          live_room_id: roomId,
          livekit_egress_id: egress.egressId,
          status: "recording",
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to save recording" },
          { status: 500 },
        );
      }

      return NextResponse.json({ recording });
    }

    if (action === "stop") {
      const { egressId } = body as { egressId?: string };

      // Find the active recording
      let targetEgressId = egressId;
      if (!targetEgressId) {
        const { data: rec } = await supabase
          .from("live_recordings")
          .select("livekit_egress_id")
          .eq("live_room_id", roomId)
          .eq("status", "recording")
          .order("started_at", { ascending: false })
          .limit(1)
          .single();
        targetEgressId = rec?.livekit_egress_id ?? undefined;
      }

      if (!targetEgressId) {
        return NextResponse.json(
          { error: "No active recording found" },
          { status: 404 },
        );
      }

      await egressClient.stopEgress(targetEgressId);

      await supabase
        .from("live_recordings")
        .update({ status: "processing", ended_at: new Date().toISOString() })
        .eq("livekit_egress_id", targetEgressId);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("LiveKit recording error:", msg);
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 },
    );
  }
}
