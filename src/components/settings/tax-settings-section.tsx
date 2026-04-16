"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Percent,
  Plus,
  Trash2,
} from "lucide-react";

interface TaxRateEntry {
  id: string; // may be a temporary id for rows not yet saved
  currency: string;
  label: string;
  rate: number;
  enabled: boolean;
}

const CURRENCIES = ["GBP", "EUR", "USD"] as const;

const CURRENCY_LABELS: Record<string, string> = {
  GBP: "GBP — United Kingdom",
  EUR: "EUR — Ireland / EU",
  USD: "USD — United States",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "\u00a3",
  EUR: "\u20ac",
  USD: "$",
};

let tempIdCounter = 0;
function makeTempId() {
  tempIdCounter += 1;
  return `temp-${tempIdCounter}`;
}

export function TaxSettingsSection() {
  const [rates, setRates] = useState<TaxRateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
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

  const byCurrency = useMemo(() => {
    const map: Record<string, TaxRateEntry[]> = {};
    for (const cur of CURRENCIES) map[cur] = [];
    for (const r of rates) {
      if (!map[r.currency]) map[r.currency] = [];
      map[r.currency].push(r);
    }
    return map;
  }, [rates]);

  function addRate(currency: string) {
    setRates((prev) => [
      ...prev,
      {
        id: makeTempId(),
        currency,
        label: currency === "USD" ? "Sales Tax" : "VAT",
        rate: 0,
        enabled: true,
      },
    ]);
  }

  function removeRate(id: string) {
    setRates((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRate(
    id: string,
    field: keyof TaxRateEntry,
    value: unknown,
  ) {
    setRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");

    try {
      const payload = rates.map((r) => ({
        currency: r.currency,
        label: r.label.trim() || "Tax",
        rate: Number(r.rate) || 0,
        enabled: r.enabled,
      }));

      const res = await fetch("/api/settings/tax-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        <p className="text-muted-foreground">Loading tax settings…</p>
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
          <p className="text-muted-foreground">
            Add one or more tax rates per currency. Rates marked{" "}
            <em>Show on invoice</em> appear as options when creating a new
            invoice.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {CURRENCIES.map((currency) => {
          const list = byCurrency[currency] || [];
          return (
            <div
              key={currency}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-xs font-bold shadow-sm">
                    {CURRENCY_SYMBOLS[currency]}
                  </span>
                  <span className="font-semibold">
                    {CURRENCY_LABELS[currency]}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRate(currency)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Rate
                </Button>
              </div>

              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-background/60 p-3 text-center text-sm text-muted-foreground">
                  No tax rates for {currency} yet. Click “Add Rate” to create
                  one.
                </p>
              ) : (
                <div className="space-y-2">
                  {list.map((rate) => (
                    <div
                      key={rate.id}
                      className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_140px_auto_auto] sm:items-end"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tax Label</Label>
                        <Input
                          value={rate.label}
                          onChange={(e) =>
                            updateRate(rate.id, "label", e.target.value)
                          }
                          placeholder="e.g. VAT, Reduced VAT"
                          className="h-9"
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
                            updateRate(
                              rate.id,
                              "rate",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="0"
                          className="h-9"
                        />
                      </div>

                      <label className="flex items-center gap-2 pb-1.5">
                        <input
                          type="checkbox"
                          checked={rate.enabled}
                          onChange={(e) =>
                            updateRate(rate.id, "enabled", e.target.checked)
                          }
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="whitespace-nowrap text-sm">
                          Show on invoice
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeRate(rate.id)}
                        className="mb-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete tax rate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save Tax Settings"}
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
