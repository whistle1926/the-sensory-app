"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Loader2, Send, Receipt } from "lucide-react";
import { CURRENCY_LABELS, CURRENCY_SYMBOLS } from "@/lib/currencies";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  parentCarerEmail: string | null;
  parentCarerName: string | null;
  address: string | null;
  currency: string;
}

interface LineItem {
  key: number;
  description: string;
  quantity: number;
  unitPrice: string; // stored as string for controlled input (pounds)
}

interface Service {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  currency: string;
  category: string;
  defaultTaxRateId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(pence: number, cur: string = "GBP"): string {
  const locales: Record<string, string> = { GBP: "en-GB", EUR: "en-IE", USD: "en-US" };
  return (pence / 100).toLocaleString(locales[cur] || "en-GB", {
    style: "currency",
    currency: cur,
  });
}

function defaultDueDate(): string {
  // Default to "due on issue" (the same day). Schools etc. that get 30-day
  // terms can have the date changed manually before sending.
  return new Date().toISOString().split("T")[0];
}

let nextKey = 1;
function makeItem(): LineItem {
  return { key: nextKey++, description: "", quantity: 1, unitPrice: "" };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function NewInvoicePage() {
  const router = useRouter();

  /* ---- clients ---- */
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  /* ---- form fields ---- */
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [notes, setNotes] = useState("");
  const [bankTransfer, setBankTransfer] = useState(false);
  const [items, setItems] = useState<LineItem[]>([makeItem()]);

  /* ---- tax ---- */
  interface AvailableTaxRate {
    id: string;
    currency: string;
    label: string;
    rate: number;
    enabled: boolean;
  }
  const [availableTaxRates, setAvailableTaxRates] = useState<AvailableTaxRate[]>([]);
  const [selectedTaxId, setSelectedTaxId] = useState<string>(""); // "" = no tax

  /* ---- enabled currencies (from payment settings) ---- */
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>([
    "GBP",
    "EUR",
  ]);

  /* ---- service catalogue (filtered by invoice currency) ---- */
  const [services, setServices] = useState<Service[]>([]);

  /* ---- ui state ---- */
  const [saving, setSaving] = useState(false);
  const [sendAfterSave, setSendAfterSave] = useState(false);
  const [error, setError] = useState("");

  /* ---- load clients ---- */
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  /* ---- fetch all tax rates + enabled currencies once ---- */
  useEffect(() => {
    fetch("/api/settings/tax-rates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAvailableTaxRates(data);
      })
      .catch(() => {});
    fetch("/api/settings/currencies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.currencies)) setEnabledCurrencies(data.currencies);
      })
      .catch(() => {});
  }, []);

  /* ---- load service catalogue whenever the invoice currency changes ---- */
  useEffect(() => {
    fetch(`/api/services?currency=${encodeURIComponent(currency)}`)
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]));
  }, [currency]);

  /* ---- options shown in picker for the current currency ---- */
  const taxOptions = availableTaxRates.filter(
    (r) => r.currency === currency && r.enabled,
  );

  /* ---- reset tax selection when currency changes ----
   * Default is now "No tax" (Grace's request). We only clear an
   * invalid selection (e.g. a rate that doesn't exist for the new
   * currency); we never auto-pick a rate. The service picker can still
   * set a specific rate explicitly when a service has a default. */
  useEffect(() => {
    if (taxOptions.some((o) => o.id === selectedTaxId)) return;
    setSelectedTaxId(""); // "" = No tax
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, availableTaxRates]);

  const selectedTax = taxOptions.find((o) => o.id === selectedTaxId) || null;
  const taxLabel = selectedTax?.label ?? "";
  const taxRate = selectedTax?.rate ?? 0;
  const taxEnabled = !!selectedTax && taxRate > 0;

  /* ---- filtered client list ---- */
  const filteredClients = clientSearch.trim()
    ? clients.filter((c) => {
        const q = clientSearch.toLowerCase();
        const full = `${c.firstName} ${c.lastName}`.toLowerCase();
        const email = (c.parentCarerEmail || "").toLowerCase();
        return full.includes(q) || email.includes(q);
      })
    : clients;

  /* ---- select a client from the dropdown ---- */
  function selectClient(c: Client) {
    setSelectedClientId(c.id);
    setClientName(`${c.firstName} ${c.lastName}`);
    setClientEmail(c.parentCarerEmail || "");
    setClientAddress(c.address || "");
    setCurrency(c.currency || "GBP");
    setClientSearch(`${c.firstName} ${c.lastName}`);
    setShowDropdown(false);
  }

  /* ---- clear the client selection ---- */
  function clearClient() {
    setSelectedClientId(null);
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setClientSearch("");
    setCurrency("GBP");
  }

  /* ---- line item helpers ---- */
  function updateItem(key: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function addItem() {
    setItems((prev) => [...prev, makeItem()]);
  }

  /** Quick-add a pre-labelled line. "Discount" is just a normal line with
   * a negative amount, so it subtracts from the subtotal and is taxed
   * consistently with everything else. */
  function addPreset(description: string) {
    setItems((prev) => [...prev, { ...makeItem(), description }]);
  }

  /* ---- calculate totals ---- */
  function itemAmountPence(item: LineItem): number {
    const price = parseFloat(item.unitPrice) || 0;
    return Math.round(price * 100) * item.quantity;
  }

  const subtotalPence = items.reduce((sum, item) => sum + itemAmountPence(item), 0);
  const taxPence = taxEnabled && taxRate > 0 ? Math.round(subtotalPence * taxRate / 100) : 0;
  const totalPence = subtotalPence + taxPence;

  /* ---- submit ---- */
  async function handleSubmit(shouldSend: boolean) {
    setError("");

    // Client-side validation
    if (!clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    if (!clientEmail.trim()) {
      setError("Client email is required.");
      return;
    }
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }
    if (items.some((item) => !item.description.trim())) {
      setError("Each line item must have a description.");
      return;
    }
    // A discount line is a negative price, so only a missing/zero/invalid
    // amount is rejected — not a negative one.
    if (
      items.some(
        (item) =>
          !item.unitPrice ||
          !Number.isFinite(parseFloat(item.unitPrice)) ||
          parseFloat(item.unitPrice) === 0,
      )
    ) {
      setError("Each line item must have a valid unit price.");
      return;
    }
    if (subtotalPence < 0) {
      setError("The total can't be negative — check the discount amount.");
      return;
    }

    setSaving(true);
    setSendAfterSave(shouldSend);

    try {
      const body = {
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        clientAddress: clientAddress.trim() || undefined,
        currency,
        dueDate: new Date(dueDate + "T00:00:00.000Z").toISOString(),
        notes: notes.trim() || undefined,
        bankTransfer,
        // Explicitly selected tax — send the picked label/rate, API will use it.
        // Omit (or 0) for "No tax".
        taxLabel: taxEnabled ? taxLabel : undefined,
        taxRate: taxEnabled ? taxRate : 0,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: Math.round(parseFloat(item.unitPrice) * 100),
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create invoice.");
        setSaving(false);
        return;
      }

      const invoice = await res.json();

      // `shouldSend` now means "review & send" — land on the invoice
      // detail page with the composer auto-opened so Patrick can
      // personalise the subject + note, eyeball the live preview,
      // optionally add a CC, and confirm before the email goes out.
      // (Previously this one-click sent the email straight away.)
      router.push(`/invoices/${invoice.id}${shouldSend ? "?compose=1" : ""}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div>
      {/* ---- Header ---- */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Create Invoice</h1>
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ---- Two-column grid ---- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Left column (2/3 width) ---- */}
        <div className="lg:col-span-2 space-y-4">
          {/* ---- Client Selection ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Searchable client dropdown */}
              <div className="space-y-2">
                <Label>Search existing clients</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Type to search clients..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowDropdown(true);
                      if (selectedClientId) {
                        clearClient();
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && filteredClients.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectClient(c)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">
                            {c.firstName} {c.lastName}
                          </span>
                          {c.parentCarerEmail && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.parentCarerEmail}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && clientSearch.trim() && filteredClients.length === 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover p-3 text-center text-sm text-muted-foreground shadow-md">
                      No clients found. Fill in the details manually below.
                    </div>
                  )}
                </div>
                {selectedClientId && (
                  <p className="text-xs text-muted-foreground">
                    Linked to existing client record.{" "}
                    <button
                      type="button"
                      onClick={clearClient}
                      className="text-primary hover:underline"
                    >
                      Clear
                    </button>
                  </p>
                )}
              </div>

              {/* Click outside to close dropdown */}
              {showDropdown && (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Claire O'Connor"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Client Email *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="e.g. claire@example.com"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="clientAddress">Client Address</Label>
                  <textarea
                    id="clientAddress"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={3}
                    placeholder={"e.g.\n12 Main Street\nArmagh\nBT60 1AA"}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on the invoice. Pre-filled from the client and saved
                    back to them for next time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---- Line Items ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Item {index + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {services.length > 0 && (
                      <ServicePicker
                        services={services}
                        currency={currency}
                        onPick={(svc) => {
                          updateItem(item.key, "description", svc.name);
                          if (svc.pricePence > 0) {
                            updateItem(
                              item.key,
                              "unitPrice",
                              (svc.pricePence / 100).toFixed(2),
                            );
                          }
                          // If the service has a default tax that is
                          // valid for the current invoice currency,
                          // switch the invoice's tax selector to it.
                          if (
                            svc.defaultTaxRateId &&
                            taxOptions.some(
                              (t) => t.id === svc.defaultTaxRateId,
                            )
                          ) {
                            setSelectedTaxId(svc.defaultTaxRateId);
                          }
                        }}
                      />
                    )}
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.key, "description", e.target.value)
                        }
                        placeholder="e.g. OT Assessment Session (1 hour)"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "quantity",
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit Price ({currency === "EUR" ? "\u20AC" : currency === "USD" ? "$" : "\u00A3"})</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.key, "unitPrice", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <div className="flex h-8 items-center rounded-lg border border-input bg-muted/50 px-2.5 text-sm font-medium">
                          {formatCurrency(itemAmountPence(item), currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add item + quick presets. Travel is just a labelled line;
                  a discount is a line with a negative amount. */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addItem}
                  className="flex-1"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addPreset("Travel expenses")}
                  className="flex-1"
                  title="Add a travel expenses line"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Travel expenses
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addPreset("Discount")}
                  className="flex-1"
                  title="Add a discount line — enter the amount as a negative, e.g. -25"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Discount
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pick a service to auto-fill its description and price — you can
                still edit either. For a discount, enter the amount as a
                negative (e.g. <strong>-25</strong>) so it comes off the total.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Right column (1/3 width, sticky) ---- */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* ---- Invoice Details ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {enabledCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code} ({CURRENCY_SYMBOLS[code] || code}) &mdash;{" "}
                      {(CURRENCY_LABELS[code] || code).replace(/^[^—]+—\s*/, "")}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Auto-filled from client profile. Change if needed for this invoice.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Quick set:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDueDate(new Date().toISOString().split("T")[0])
                    }
                    className="rounded-md border border-border px-2 py-0.5 font-medium hover:bg-muted"
                  >
                    Due on issue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 30);
                      setDueDate(d.toISOString().split("T")[0]);
                    }}
                    className="rounded-md border border-border px-2 py-0.5 font-medium hover:bg-muted"
                  >
                    30 days (schools)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes for the client..."
                  rows={3}
                />
              </div>

              {/* Bank transfer option — for schools / EA finance who pay
                  by BACS rather than the card link. */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <input
                  type="checkbox"
                  checked={bankTransfer}
                  onChange={(e) => setBankTransfer(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Offer bank transfer
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Shows your bank details + this invoice number as the
                    reference on the invoice and email. Ideal for schools /
                    Education Authority finance. (Set your bank details in
                    Settings → Payments.)
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          {/* ---- Totals ---- */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              {taxOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="taxSelect" className="text-xs">
                    Tax
                  </Label>
                  <select
                    id="taxSelect"
                    value={selectedTaxId}
                    onChange={(e) => setSelectedTaxId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No Tax</option>
                    {taxOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} ({o.rate}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotalPence, currency)}</span>
              </div>
              {taxEnabled && taxRate > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{taxLabel} ({taxRate}%)</span>
                  <span className="font-medium">{formatCurrency(taxPence, currency)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold tracking-tight">
                  {formatCurrency(totalPence, currency)}
                </span>
              </div>
              {taxOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No tax rates configured for {currency}. Add one in Settings &rarr; Tax.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ---- Actions ---- */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="w-full"
            >
              {saving && sendAfterSave ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Save & Review Email
                </>
              )}
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              variant="outline"
              className="w-full"
            >
              {saving && !sendAfterSave ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save as Draft"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Service picker — searchable dropdown over the catalogue            */
/* ------------------------------------------------------------------ */

function ServicePicker({
  services,
  currency,
  onPick,
}: {
  services: Service[];
  currency: string;
  onPick: (svc: Service) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = query.trim()
    ? services.filter((s) => {
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        );
      })
    : services;

  return (
    <div className="space-y-2">
      <Label>Pick from services</Label>
      <div className="relative">
        <Input
          type="text"
          placeholder="Search your services…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onPick(s);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  {s.category && (
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.category}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {s.pricePence === 0
                    ? "Quote"
                    : formatCurrency(s.pricePence, currency)}
                </span>
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && filtered.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover p-3 text-center text-sm text-muted-foreground shadow-md">
            No services match. Type below to enter manually.
          </div>
        )}
        {open && (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
