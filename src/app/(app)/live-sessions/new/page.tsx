"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Radio, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toolbar, Panel } from "@/components/ds";

/**
 * Create-session form. Minimum fields: title, mode. Schedule defaults to
 * "now" so the host can hit Go Live immediately.
 */
export default function NewLiveSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"broadcast" | "interactive">("broadcast");
  const [scheduledStart, setScheduledStart] = useState("");
  const [requireAuth, setRequireAuth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Please give the session a title.");
    setSaving(true);
    try {
      const res = await fetch("/api/livekit/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          mode,
          scheduledStart: scheduledStart
            ? new Date(scheduledStart).toISOString()
            : new Date().toISOString(),
          requireAuth,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create session.");
        setSaving(false);
        return;
      }
      router.push(`/live-sessions/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/live-sessions"
        className="ds-link inline-flex items-center"
        style={{ fontWeight: 500 }}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Back to Live Sessions
      </Link>
      <Toolbar
        title="New Live Session"
        subtitle="Schedule a broadcast or an interactive room. You can start it immediately or at the scheduled time."
      />

      <form onSubmit={onSubmit}>
        <Panel padded>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Parent Q&A — April"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What will the session cover?"
              />
            </div>

            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("broadcast")}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    mode === "broadcast"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <p className="font-semibold">Broadcast</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You publish cam/mic, viewers watch and chat only. Best for
                    talks, classes, Q&As.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("interactive")}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    mode === "interactive"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    <p className="font-semibold">Interactive</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Everyone can publish cam/mic. Best for small group calls
                    or workshops.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledStart">
                Scheduled start{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (leave blank for &ldquo;now&rdquo;)
                </span>
              </Label>
              <Input
                id="scheduledStart"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requireAuth}
                onChange={(e) => setRequireAuth(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>
                Require sign-in to watch — only logged-in users can join
              </span>
            </label>

            {error && (
              <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Creating…" : "Create session"}
            </Button>
            <Link href="/live-sessions">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </Panel>
      </form>
    </div>
  );
}
