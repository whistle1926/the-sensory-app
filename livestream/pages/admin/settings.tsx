"use client";

import { useEffect, useState } from "react";
import {
  getLiveKitConfig,
  upsertLiveKitConfig,
  type LiveKitConfig,
} from "@/lib/livekit-settings";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LiveSessionsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<LiveKitConfig>({
    api_key: "",
    api_secret: "",
    ws_url: "",
    recording_bucket: "",
  });

  useEffect(() => {
    getLiveKitConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertLiveKitConfig(config);
      toast.success("LiveKit settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Sessions Settings</h1>
          <p className="text-muted-foreground">
            Configure LiveKit connection and recording settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LiveKit Configuration</CardTitle>
          <CardDescription>
            API credentials and connection details for your LiveKit server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>API Key</Label>
            <Input
              value={config.api_key}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, api_key: e.target.value }))
              }
              placeholder="APIxxxxxxxx"
            />
          </div>
          <div>
            <Label>API Secret</Label>
            <Input
              type="password"
              value={config.api_secret}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, api_secret: e.target.value }))
              }
              placeholder="Enter your API secret"
            />
          </div>
          <div>
            <Label>WebSocket URL</Label>
            <Input
              value={config.ws_url}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, ws_url: e.target.value }))
              }
              placeholder="wss://your-server.livekit.cloud"
            />
          </div>
          <div>
            <Label>Recording Bucket</Label>
            <Input
              value={config.recording_bucket}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  recording_bucket: e.target.value,
                }))
              }
              placeholder="recordings"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
