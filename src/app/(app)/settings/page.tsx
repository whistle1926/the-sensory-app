"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface EmailConfig {
  provider: string;
  apiKey: string;
  senderEmail: string;
  senderName: string;
  enabled: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "SUPER_ADMIN";

  const roleLabel = (session?.user?.role || "")
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (l: string) => l.toUpperCase());

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    provider: "mailcub",
    apiKey: "",
    senderEmail: "",
    senderName: "The Sensory Submarine",
    enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/settings/email")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setEmailConfig(data);
      });
  }, [isAdmin]);

  async function handleSaveEmail() {
    setSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");

    try {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setEmailConfig(data);
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Failed to save");
        setSaveStatus("error");
      }
    } catch {
      setErrorMessage("Network error");
      setSaveStatus("error");
    }

    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Profile Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="font-medium text-muted-foreground">Name</span>
            <span className="font-medium">{session?.user?.name || "\u2014"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="font-medium text-muted-foreground">Email</span>
            <span className="font-medium">{session?.user?.email || "\u2014"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Role</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              {roleLabel || "\u2014"}
            </span>
          </div>
        </div>
      </div>

      {/* Mailcub Email Integration — Admin Only */}
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Email Integration</h2>
              <p className="text-sm text-muted-foreground">
                Connect Mailcub to send reports directly to clients
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Email Sending</p>
                <p className="text-xs text-muted-foreground">
                  Allow sending OT reports via email from the Reports page
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailConfig.enabled}
                onClick={() =>
                  setEmailConfig({ ...emailConfig, enabled: !emailConfig.enabled })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  emailConfig.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    emailConfig.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">Mailcub API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your Mailcub API key"
                value={emailConfig.apiKey}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, apiKey: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Find this in your{" "}
                <a
                  href="https://mailcub.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Mailcub dashboard
                </a>{" "}
                under API Keys
              </p>
            </div>

            {/* Sender Email */}
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Sender Email Address</Label>
              <Input
                id="senderEmail"
                type="email"
                placeholder="reports@yourdomain.com"
                value={emailConfig.senderEmail}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, senderEmail: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Domain must be verified in your Mailcub account
              </p>
            </div>

            {/* Sender Name */}
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender Display Name</Label>
              <Input
                id="senderName"
                placeholder="The Sensory Submarine"
                value={emailConfig.senderName}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, senderName: e.target.value })
                }
              />
            </div>

            {/* Save + Status */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveEmail} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? "Saving..." : "Save Settings"}
              </Button>

              {saveStatus === "success" && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
