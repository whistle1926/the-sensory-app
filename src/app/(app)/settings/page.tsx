"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Save, CheckCircle2, AlertCircle, Loader2, Bot, CreditCard } from "lucide-react";
import { ClientStagesSection } from "@/components/settings/client-stages-section";
import { DashTemplatesSection } from "@/components/settings/dash-templates-section";

interface EmailConfig {
  provider: string;
  apiKey: string;
  senderEmail: string;
  senderName: string;
  enabled: boolean;
}

interface AiConfig {
  provider: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

interface PaymentConfig {
  provider: string;
  apiKey: string;
  webhookSecret: string;
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
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    provider: "anthropic",
    apiKey: "",
    model: "claude-sonnet-4-20250514",
    enabled: false,
  });
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    provider: "firebuddy",
    apiKey: "",
    webhookSecret: "",
    enabled: false,
  });

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const [savingAi, setSavingAi] = useState(false);
  const [aiSaveStatus, setAiSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [aiErrorMessage, setAiErrorMessage] = useState("");

  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaveStatus, setPaymentSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [paymentErrorMessage, setPaymentErrorMessage] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/settings/email")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setEmailConfig(data);
      });
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setAiConfig(data);
      });
    fetch("/api/settings/payment")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setPaymentConfig(data);
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

  async function handleSaveAi() {
    setSavingAi(true);
    setAiSaveStatus("idle");
    setAiErrorMessage("");

    try {
      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setAiConfig(data);
        setAiSaveStatus("success");
        setTimeout(() => setAiSaveStatus("idle"), 3000);
      } else {
        const err = await res.json();
        setAiErrorMessage(err.error || "Failed to save");
        setAiSaveStatus("error");
      }
    } catch {
      setAiErrorMessage("Network error");
      setAiSaveStatus("error");
    }

    setSavingAi(false);
  }

  async function handleSavePayment() {
    setSavingPayment(true);
    setPaymentSaveStatus("idle");
    setPaymentErrorMessage("");

    try {
      const res = await fetch("/api/settings/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentConfig(data);
        setPaymentSaveStatus("success");
        setTimeout(() => setPaymentSaveStatus("idle"), 3000);
      } else {
        const err = await res.json();
        setPaymentErrorMessage(err.error || "Failed to save");
        setPaymentSaveStatus("error");
      }
    } catch {
      setPaymentErrorMessage("Network error");
      setPaymentSaveStatus("error");
    }

    setSavingPayment(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Profile Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
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

      {/* Client Journey Stages — Admin Only */}
      {isAdmin && <ClientStagesSection />}

      {/* Dashboard Templates — Admin Only */}
      {isAdmin && <DashTemplatesSection />}

      {/* Mailcub Email Integration — Admin Only */}
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
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

      {/* Claude AI Integration — Admin Only */}
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Claude AI</h2>
              <p className="text-sm text-muted-foreground">
                Power report generation and content creation with Claude
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable AI Features</p>
                <p className="text-xs text-muted-foreground">
                  Use Claude to assist with OT reports, home programmes, and content
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiConfig.enabled}
                onClick={() =>
                  setAiConfig({ ...aiConfig, enabled: !aiConfig.enabled })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  aiConfig.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    aiConfig.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="aiApiKey">Claude API Key</Label>
              <Input
                id="aiApiKey"
                type="password"
                placeholder="sk-ant-..."
                value={aiConfig.apiKey}
                onChange={(e) =>
                  setAiConfig({ ...aiConfig, apiKey: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from the{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Anthropic Console
                </a>
              </p>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <Label htmlFor="aiModel">Model</Label>
              <select
                id="aiModel"
                value={aiConfig.model}
                onChange={(e) =>
                  setAiConfig({ ...aiConfig, model: e.target.value })
                }
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4 — Fast, great for reports</option>
                <option value="claude-opus-4-20250514">Claude Opus 4 — Most capable</option>
                <option value="claude-haiku-4-20250506">Claude Haiku 4 — Fastest, lower cost</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Sonnet is recommended for most tasks — good balance of speed and quality
              </p>
            </div>

            {/* Save + Status */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveAi} disabled={savingAi}>
                {savingAi ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {savingAi ? "Saving..." : "Save Settings"}
              </Button>

              {aiSaveStatus === "success" && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </span>
              )}
              {aiSaveStatus === "error" && (
                <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {aiErrorMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FireBuddy Payment Integration — Admin Only */}
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Payment Integration</h2>
              <p className="text-sm text-muted-foreground">
                Accept payments via FireBuddy (open banking)
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Payments</p>
                <p className="text-xs text-muted-foreground">
                  Collect payment when clients book a session
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={paymentConfig.enabled}
                onClick={() =>
                  setPaymentConfig({ ...paymentConfig, enabled: !paymentConfig.enabled })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  paymentConfig.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    paymentConfig.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="paymentApiKey">FireBuddy API Key</Label>
              <Input
                id="paymentApiKey"
                type="password"
                placeholder="fb_live_..."
                value={paymentConfig.apiKey}
                onChange={(e) =>
                  setPaymentConfig({ ...paymentConfig, apiKey: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Your API key from the FireBuddy dashboard
              </p>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Secret</Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="whsec_..."
                value={paymentConfig.webhookSecret}
                onChange={(e) =>
                  setPaymentConfig({ ...paymentConfig, webhookSecret: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used to verify payment notifications. Configure your webhook URL as:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  https://yourdomain.com/api/webhooks/firebuddy
                </code>
              </p>
            </div>

            {/* Save + Status */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSavePayment} disabled={savingPayment}>
                {savingPayment ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {savingPayment ? "Saving..." : "Save Settings"}
              </Button>

              {paymentSaveStatus === "success" && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </span>
              )}
              {paymentSaveStatus === "error" && (
                <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {paymentErrorMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
