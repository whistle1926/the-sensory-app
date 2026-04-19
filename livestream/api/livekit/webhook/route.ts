import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

// Use service role for webhook (no user session)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const authHeader = request.headers.get("Authorization") || "";

    // Load config for webhook verification
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "livekit_config")
      .maybeSingle();

    let apiKey = process.env.LIVEKIT_API_KEY || "";
    let apiSecret = process.env.LIVEKIT_API_SECRET || "";

    if (setting?.value) {
      const cfg =
        typeof setting.value === "string"
          ? JSON.parse(setting.value)
          : setting.value;
      apiKey = cfg.api_key || apiKey;
      apiSecret = cfg.api_secret || apiSecret;
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 500 },
      );
    }

    // Verify webhook signature
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    let event;
    try {
      event = await receiver.receive(body, authHeader);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Handle egress events
    if (event.event === "egress_ended" && event.egressInfo) {
      const egressId = event.egressInfo.egressId;

      // Get file info from the egress result
      const fileResults = event.egressInfo.fileResults ?? [];
      const file = fileResults[0];

      await supabase
        .from("live_recordings")
        .update({
          status: "ready",
          storage_url: file?.location ?? null,
          storage_key: file?.filename ?? null,
          duration_seconds: file?.duration
            ? Math.round(Number(file.duration) / 1_000_000_000)
            : null,
          file_size_bytes: file?.size ? Number(file.size) : null,
          ended_at: new Date().toISOString(),
        })
        .eq("livekit_egress_id", egressId);
    }

    if (event.event === "egress_started" && event.egressInfo) {
      // No-op: recording already marked as 'recording' on start
    }

    if (
      (event.event as string) === "egress_failed" &&
      event.egressInfo
    ) {
      const egressId = event.egressInfo.egressId;
      await supabase
        .from("live_recordings")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
        })
        .eq("livekit_egress_id", egressId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("LiveKit webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
