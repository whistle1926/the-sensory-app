"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, CheckCircle2, AlertCircle, Percent } from "lucide-react";

interface TaxRateEntry {
  currency: string;
  label: string;
  rate: number;
  enabled: boolean;
}

const CURRENCY_LABELS: Record<string, string> = {
  GBP: "GBP - United Kingdom",
  EUR: "EUR - Ireland / EU",
  USD: "USD - United States",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "\u00a3",
  EUR: "\u20ac",
  USD: "$",
};

export function TaxSettingsSection() {
  const [rates, setRates] = useState<TaxRateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/tax-rates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRates(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function updateRate(currency: string, field: keyof TaxRateEntry, value: unknown) {
    setRates((prev) =>
      prev.map((r) => (r.currency === currency ? { ...r, [field]: value } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");

    try {
      const res = await fetch("/api/settings/tax-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rates),
      });

      if (res.ok) {
        const data = await res.json();
        setRates(data);
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <p className="text-sm text-muted-foreground">Loading tax settings...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Percent className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Tax Rates</h2>
          <p className="text-sm text-muted-foreground">
            Set tax rates per currency. When enabled, the rate is automatically applied to new invoices.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rates.map((rate) => (
          <div
            key={rate.currency}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold shadow-sm border border-border">
                  {CURRENCY_SYMBOLS[rate.currency] || rate.currency}
                </span>
                <span className="text-sm font-semibold">{CURRENCY_LABELS[rate.currency] || rate.currency}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={rate.enabled}
                onClick={() => updateRate(rate.currency, "enabled", !rate.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  rate.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    rate.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Label</Label>
                <Input
                  value={rate.label}
                  onChange={(e) => updateRate(rate.currency, "label", e.target.value)}
                  placeholder="e.g. VAT, Sales Tax"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={rate.rate}
                  onChange={(e) =>
                    updateRate(rate.currency, "rate", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {rate.enabled && rate.rate > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {rate.label} at {rate.rate}% will be added to invoices in {rate.currency}.
              </p>
            )}
            {rate.enabled && rate.rate === 0 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Enabled but rate is 0% &mdash; no tax will be charged.
              </p>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Tax Settings"}
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
  );
}
