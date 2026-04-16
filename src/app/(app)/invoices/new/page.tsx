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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  parentCarerEmail: string | null;
  parentCarerName: string | null;
}

interface LineItem {
  key: number;
  description: string;
  quantity: number;
  unitPrice: string; // stored as string for controlled input (pounds)
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(pence: number): string {
  return (pence / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
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
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem()]);

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
    setClientSearch(`${c.firstName} ${c.lastName}`);
    setShowDropdown(false);
  }

  /* ---- clear the client selection ---- */
  function clearClient() {
    setSelectedClientId(null);
    setClientName("");
    setClientEmail("");
    setClientSearch("");
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

  /* ---- calculate totals ---- */
  function itemAmountPence(item: LineItem): number {
    const price = parseFloat(item.unitPrice) || 0;
    return Math.round(price * 100) * item.quantity;
  }

  const subtotalPence = items.reduce((sum, item) => sum + itemAmountPence(item), 0);

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
    if (items.some((item) => !item.unitPrice || parseFloat(item.unitPrice) <= 0)) {
      setError("Each line item must have a valid unit price.");
      return;
    }

    setSaving(true);
    setSendAfterSave(shouldSend);

    try {
      const body = {
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        dueDate: new Date(dueDate + "T00:00:00.000Z").toISOString(),
        notes: notes.trim() || undefined,
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

      if (shouldSend) {
        const sendRes = await fetch(`/api/invoices/${invoice.id}/send`, {
          method: "POST",
        });

        if (!sendRes.ok) {
          // Invoice was created but send failed - still navigate to it
          const sendData = await sendRes.json();
          console.error("Send failed:", sendData.error);
        }
      }

      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
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

      {/* ---- Client Selection ---- */}
      <Card className="mb-4">
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
          </div>
        </CardContent>
      </Card>

      {/* ---- Invoice Details ---- */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
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
        </CardContent>
      </Card>

      {/* ---- Line Items ---- */}
      <Card className="mb-6">
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
                    <Label>Unit Price (&pound;)</Label>
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
                      {formatCurrency(itemAmountPence(item))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add item button */}
          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>

          {/* Totals */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold tracking-tight">
                {formatCurrency(subtotalPence)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Actions ---- */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          variant="outline"
          className="flex-1"
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
        <Button
          onClick={() => handleSubmit(true)}
          disabled={saving}
          className="flex-1"
        >
          {saving && sendAfterSave ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving & Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Save & Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
