import { supabase } from "@/lib/supabase";

export interface LiveKitConfig {
  api_key: string;
  api_secret: string;
  ws_url: string;
  recording_bucket: string;
}

const DEFAULT_CONFIG: LiveKitConfig = {
  api_key: "",
  api_secret: "",
  ws_url: "",
  recording_bucket: "recordings",
};

export async function getLiveKitConfig(): Promise<LiveKitConfig> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "livekit_config")
    .maybeSingle();

  if (data?.value) {
    try {
      const parsed =
        typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (parsed?.ws_url !== undefined) return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      // fall through
    }
  }
  return DEFAULT_CONFIG;
}

export async function upsertLiveKitConfig(
  config: LiveKitConfig,
): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: "livekit_config", value: JSON.stringify(config) },
      { onConflict: "key" },
    );
  if (error) throw error;
}
