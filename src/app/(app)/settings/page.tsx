"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Mail,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bot,
  CreditCard,
  User,
  Milestone,
  LayoutDashboard,
  Percent,
  ExternalLink,
  GraduationCap,
  CalendarDays,
  Activity,
  PaintBucket,
  ClipboardList,
} from "lucide-react";
import { Toolbar } from "@/components/ds";
import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { ClientStagesSection } from "@/components/settings/client-stages-section";
import { EmailSignaturesSection } from "@/components/settings/email-signatures-section";
import { NotePresetsSection } from "@/components/settings/note-presets-section";
import { DashTemplatesSection } from "@/components/settings/dash-templates-section";
import { TaxSettingsSection } from "@/components/settings/tax-settings-section";
import { TrackingSettingsSection } from "@/components/settings/tracking-settings-section";
import { StorefrontSettingsSection } from "@/components/settings/storefront-settings-section";
import { SpmSettingsSection } from "@/components/settings/spm-settings-section";
import {
  CORE_CURRENCIES,
  KNOWN_CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  isCoreCurrency,
} from "@/lib/currencies";
import { X as XIcon, Plus } from "lucide-react";

interface EmailConfig {
  provider: string;
  apiKey: string;
  /** Server flag — true when a key is already saved. The form keeps
   * the input blank in that case so the user can't accidentally type
   * over a working key. */
  hasKey?: boolean;
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
  currencies: string[];
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  bankEurAccountName: string;
  bankIban: string;
  bankBic: string;
  bankTransferInstructions: string;
}

const tabs = [
  { key: "profile", label: "Profile", icon: User, adminOnly: false },
  { key: "calendar", label: "Calendar", icon: CalendarDays, adminOnly: false },
  { key: "stages", label: "Client Stages", icon: Milestone, adminOnly: true },
  { key: "assessments", label: "Assessments", icon: ClipboardList, adminOnly: true },
  { key: "templates", label: "Templates", icon: LayoutDashboard, adminOnly: true },
  { key: "email", label: "Email", icon: Mail, adminOnly: true },
  { key: "ai", label: "AI", icon: Bot, adminOnly: true },
  { key: "payments", label: "Payments", icon: CreditCard, adminOnly: true },
  { key: "tax", label: "Tax", icon: Percent, adminOnly: true },
  { key: "tracking", label: "Tracking", icon: Activity, adminOnly: true },
  { key: "storefront", label: "Storefront", icon: PaintBucket, adminOnly: true },
] as const;

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "SUPER_ADMIN";

  const roleLabel = (session?.user?.role || "")
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (l: string) => l.toUpperCase());

  const [activeTab, setActiveTab] = useState("profile");

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
    model: "claude-sonnet-4-6",
    enabled: false,
  });
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    provider: "firebuddy",
    apiKey: "",
    webhookSecret: "",
    enabled: false,
    currencies: ["GBP", "EUR"],
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",
    bankEurAccountName: "",
    bankIban: "",
    bankBic: "",
    bankTransferInstructions: "",
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

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <Toolbar
        title="Settings"
        subtitle="Configure stages, templates, branding, and account preferences."
      />

      {/* Tab buttons — plain buttons, no framework overhead */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* All panels always mounted, toggled via display:none */}
      <div className="space-y-4" style={{ display: activeTab === "profile" ? "block" : "none" }}>
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

        {/* Public-facing pages \u2014 quick links so admins can hop straight to the
            client-facing surfaces (open in a new tab to keep their settings
            session alive). The hostname is read at runtime so this works in
            preview deploys too. */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-semibold">Public pages</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Links your clients see. Open in a new tab.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href="/courses"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Courses storefront</span>
                  <span className="block text-xs text-muted-foreground">/courses</span>
                </span>
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
            </a>
            <a
              href="/book"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Booking page</span>
                  <span className="block text-xs text-muted-foreground">/book</span>
                </span>
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
            </a>
          </div>
        </div>

        <NotePresetsSection />
        <EmailSignaturesSection />
      </div>

      <div style={{ display: activeTab === "calendar" ? "block" : "none" }}>
        <CalendarSettingsSection />
      </div>

      {isAdmin && (
        <div style={{ display: activeTab === "stages" ? "block" : "none" }}>
          <ClientStagesSection />
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "assessments" ? "block" : "none" }}>
          <SpmSettingsSection />
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "templates" ? "block" : "none" }}>
          <DashTemplatesSection />
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "email" ? "block" : "none" }}>
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

              <div className="space-y-2">
                <Label htmlFor="apiKey">Mailcub API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder={
                    emailConfig.hasKey
                      ? "API key saved — leave blank to keep, or paste a new key to replace"
                      : "Enter your Mailcub API key"
                  }
                  value={emailConfig.apiKey}
                  onChange={(e) =>
                    setEmailConfig({ ...emailConfig, apiKey: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {emailConfig.hasKey ? (
                    <span className="text-green-700 dark:text-green-400">
                      ✓ API key saved.
                    </span>
                  ) : (
                    "No API key saved yet."
                  )}{" "}
                  Find your key in your{" "}
                  <a
                    href="https://client.mailcub.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Mailcub dashboard
                  </a>{" "}
                  under API Keys.
                </p>
              </div>

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
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "ai" ? "block" : "none" }}>
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
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 — Fast, great for reports</option>
                  <option value="claude-opus-4-8">Claude Opus 4.8 — Most capable</option>
                  <option value="claude-haiku-4-5">Claude Haiku 4.5 — Fastest, lower cost</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Sonnet is recommended for most tasks — good balance of speed and quality
                </p>
              </div>

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
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "payments" ? "block" : "none" }}>
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

              {/* ── Bank transfer details ─────────────────────────── */}
              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Bank transfer details</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown on an invoice when you tick “Offer bank transfer” —
                  e.g. for schools / Education Authority finance who pay by
                  BACS. The invoice shows the account matching its currency
                  (£ invoices → Sterling account, € invoices → Euro account),
                  with the invoice number as the payment reference.
                </p>

                {/* Sterling (GBP) account */}
                <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Sterling account (£ invoices)
                  </p>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountName">Account name</Label>
                      <Input
                        id="bankAccountName"
                        placeholder="e.g. The Sensory Submarine"
                        value={paymentConfig.bankAccountName}
                        onChange={(e) =>
                          setPaymentConfig({ ...paymentConfig, bankAccountName: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="bankSortCode">Sort code</Label>
                        <Input
                          id="bankSortCode"
                          placeholder="e.g. 95-01-21"
                          value={paymentConfig.bankSortCode}
                          onChange={(e) =>
                            setPaymentConfig({ ...paymentConfig, bankSortCode: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bankAccountNumber">Account number</Label>
                        <Input
                          id="bankAccountNumber"
                          placeholder="e.g. 12345678"
                          value={paymentConfig.bankAccountNumber}
                          onChange={(e) =>
                            setPaymentConfig({ ...paymentConfig, bankAccountNumber: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Euro (EUR) account */}
                <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Euro account (€ invoices)
                  </p>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankEurAccountName">Account name</Label>
                      <Input
                        id="bankEurAccountName"
                        placeholder="Leave blank to reuse the Sterling account name"
                        value={paymentConfig.bankEurAccountName}
                        onChange={(e) =>
                          setPaymentConfig({ ...paymentConfig, bankEurAccountName: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="bankIban">IBAN</Label>
                        <Input
                          id="bankIban"
                          placeholder="e.g. IE29 AIBK 9311 5212 3456 78"
                          value={paymentConfig.bankIban}
                          onChange={(e) =>
                            setPaymentConfig({ ...paymentConfig, bankIban: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bankBic">BIC / SWIFT</Label>
                        <Input
                          id="bankBic"
                          placeholder="e.g. AIBKIE2D"
                          value={paymentConfig.bankBic}
                          onChange={(e) =>
                            setPaymentConfig({ ...paymentConfig, bankBic: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="bankTransferInstructions">
                    Instructions (optional, shown on both)
                  </Label>
                  <textarea
                    id="bankTransferInstructions"
                    rows={2}
                    placeholder="e.g. Please quote the invoice number as the payment reference."
                    value={paymentConfig.bankTransferInstructions}
                    onChange={(e) =>
                      setPaymentConfig({
                        ...paymentConfig,
                        bankTransferInstructions: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

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

          {/* ---- Accepted Currencies ---- */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Accepted Currencies</h2>
                <p className="text-sm text-muted-foreground">
                  Currencies available for invoices and client profiles. GBP and
                  EUR are always enabled.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {paymentConfig.currencies.map((code) => (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-sm font-bold shadow-sm">
                      {CURRENCY_SYMBOLS[code] || code}
                    </span>
                    <div>
                      <p className="font-medium">
                        {CURRENCY_LABELS[code] || code}
                      </p>
                      {isCoreCurrency(code) && (
                        <p className="text-xs text-muted-foreground">
                          Core currency — cannot be removed
                        </p>
                      )}
                    </div>
                  </div>
                  {!isCoreCurrency(code) && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentConfig((prev) => ({
                          ...prev,
                          currencies: prev.currencies.filter((c) => c !== code),
                        }))
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${code}`}
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add currency picker — lists any known code not already enabled */}
            {(() => {
              const addable = KNOWN_CURRENCIES.filter(
                (c) =>
                  !paymentConfig.currencies.includes(c) &&
                  !(CORE_CURRENCIES as readonly string[]).includes(c),
              );
              if (addable.length === 0) return null;
              return (
                <div className="mt-4 flex items-center gap-2">
                  <select
                    id="addCurrency"
                    className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      const code = e.target.value;
                      if (!code) return;
                      setPaymentConfig((prev) => ({
                        ...prev,
                        currencies: [...prev.currencies, code],
                      }));
                      e.target.value = "";
                    }}
                  >
                    <option value="">Add a currency…</option>
                    {addable.map((c) => (
                      <option key={c} value={c}>
                        {CURRENCY_LABELS[c] || c}
                      </option>
                    ))}
                  </select>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })()}

            <p className="mt-4 text-xs text-muted-foreground">
              Save the Payment Integration settings above to apply currency
              changes.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "tax" ? "block" : "none" }}>
          <TaxSettingsSection />
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "tracking" ? "block" : "none" }}>
          <TrackingSettingsSection />
        </div>
      )}

      {isAdmin && (
        <div style={{ display: activeTab === "storefront" ? "block" : "none" }}>
          <StorefrontSettingsSection />
        </div>
      )}
    </div>
  );
}
