"use client";

/**
 * Services — billing catalogue editor.
 *
 * Patrick maintains a list of priced services here (sessions, reports,
 * materials, training packages…). The invoice builder pulls from this
 * list so common items can be added with one click instead of typing
 * the description + price every time.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  PoundSterling,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_SYMBOLS, KNOWN_CURRENCIES } from "@/lib/currencies";

interface ServiceRow {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  currency: string;
  category: string;
  defaultTaxRateId: string | null;
  isActive: boolean;
  order: number;
}

interface TaxRateOption {
  id: string;
  currency: string;
  label: string;
  rate: number;
  enabled: boolean;
}

function priceLabel(pence: number, currency: string): string {
  if (pence === 0) return "Quote";
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const whole = pence % 100 === 0;
  return `${symbol}${(pence / 100).toFixed(whole ? 0 : 2)}`;
}

export default function ServicesPage() {
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/services?all=1");
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as ServiceRow[];
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't load services");
    }
  }

  useEffect(() => {
    refresh();
    fetch("/api/settings/tax-rates")
      .then((r) => r.json())
      .then((data) => setTaxRates(Array.isArray(data) ? data : []))
      .catch(() => setTaxRates([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function createService() {
    setBusy(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const created = (await res.json()) as { id: string };
        await refresh();
        setEditingId(created.id);
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(body.error ?? "Couldn't create service.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchService(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteService(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? This removes the catalogue entry — existing invoices that reference it are unaffected (line items are snapshotted).`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Couldn't delete service.");
      } else {
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (rows === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading services…
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <PoundSterling className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">
            Your price list. Items here appear in the invoice picker.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, category, description…"
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <Button onClick={createService} disabled={busy} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            New service
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-950/40"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-semibold">
            {search ? "No services match this search." : "No services yet."}
          </p>
          {!search && (
            <p className="mt-1 text-xs text-muted-foreground">
              Click <strong>New service</strong>{" "}to add your first one.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((svc) =>
            editingId === svc.id ? (
              <EditorPanel
                key={svc.id}
                service={svc}
                taxRates={taxRates}
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  await patchService(svc.id, next);
                  setEditingId(null);
                }}
                busy={busy}
              />
            ) : (
              <ListRow
                key={svc.id}
                service={svc}
                taxRates={taxRates}
                onEdit={() => setEditingId(svc.id)}
                onToggleActive={() =>
                  patchService(svc.id, { isActive: !svc.isActive })
                }
                onDelete={() => deleteService(svc.id, svc.name)}
                busy={busy}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Row + editor                                                       */
/* ------------------------------------------------------------------ */

function ListRow({
  service,
  taxRates,
  onEdit,
  onToggleActive,
  onDelete,
  busy,
}: {
  service: ServiceRow;
  taxRates: TaxRateOption[];
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const tax = service.defaultTaxRateId
    ? taxRates.find((t) => t.id === service.defaultTaxRateId)
    : null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{service.name}</h3>
            {service.category && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {service.category}
              </span>
            )}
            {!service.isActive && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Inactive
              </span>
            )}
          </div>
          {service.description && (
            <p className="mt-1 line-clamp-2 max-w-3xl text-xs text-muted-foreground">
              {service.description}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-foreground">
              {priceLabel(service.pricePence, service.currency)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{service.currency}</span>
            {tax && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {tax.label} {tax.rate}%
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={busy}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold tracking-wider transition ${
              service.isActive
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
            title={service.isActive ? "Set to Inactive" : "Set to Active"}
          >
            {service.isActive ? "ACTIVE" : "OFF"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorPanel({
  service,
  taxRates,
  onCancel,
  onSave,
  busy,
}: {
  service: ServiceRow;
  taxRates: TaxRateOption[];
  onCancel: () => void;
  onSave: (next: Partial<ServiceRow>) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [category, setCategory] = useState(service.category);
  const [currency, setCurrency] = useState(service.currency);
  const [defaultTaxRateId, setDefaultTaxRateId] = useState<string>(
    service.defaultTaxRateId ?? "",
  );
  const [priceText, setPriceText] = useState(
    service.pricePence === 0 ? "" : (service.pricePence / 100).toString(),
  );

  // Tax options matching the chosen currency (e.g. only show GBP rates
  // when the service is priced in GBP). Reset the picked rate if the
  // user switches currency and the previously-picked rate no longer
  // applies.
  const taxOptions = taxRates.filter(
    (t) => t.currency === currency && t.enabled,
  );
  useEffect(() => {
    if (defaultTaxRateId && !taxOptions.some((t) => t.id === defaultTaxRateId)) {
      setDefaultTaxRateId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, taxRates]);

  async function save() {
    const parsed = parseFloat(priceText);
    const pricePence =
      Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
    await onSave({
      name,
      description,
      category,
      currency,
      pricePence,
      defaultTaxRateId: defaultTaxRateId || null,
    });
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Edit service</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            <Check className="mr-1 h-3 w-3" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="svc-name">Name *</Label>
          <Input
            id="svc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. OT Assessment (60 minutes)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="svc-category">Category</Label>
          <Input
            id="svc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Sessions, Reports"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="svc-currency">Currency</Label>
          <select
            id="svc-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {KNOWN_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} ({CURRENCY_SYMBOLS[code] || code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="svc-price">
            Default price ({CURRENCY_SYMBOLS[currency] || currency})
          </Label>
          <Input
            id="svc-price"
            type="number"
            min={0}
            step={0.01}
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="0.00 (leave blank for quote-only)"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="svc-tax">Default tax</Label>
          {taxOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No tax rates configured for {currency}. Add one in{" "}
              <a
                href="/settings"
                className="text-primary underline"
              >
                Settings → Tax
              </a>
              .
            </p>
          ) : (
            <>
              <select
                id="svc-tax"
                value={defaultTaxRateId}
                onChange={(e) => setDefaultTaxRateId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No tax</option>
                {taxOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.rate}%)
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                When this service is added to an invoice, the invoice
                tax selector flips to this rate.
              </p>
            </>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="svc-description">Description (optional)</Label>
          <Textarea
            id="svc-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Internal notes — not shown on the invoice unless you paste it in."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
