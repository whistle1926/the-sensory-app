"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Ban,
  Send,
  Trash2,
  Plus,
  Copy,
  CheckCircle2,
  Loader2,
  Pencil,
  Receipt,
  ExternalLink,
  Mail,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // pence
  amount: number; // pence
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  clientAddress: string | null;
  bankTransfer: boolean;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  notes: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paymentRef: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

interface EditableItem {
  key: number;
  id?: string;
  description: string;
  quantity: number;
  unitPrice: string; // pounds as string for input
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  Invoice["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  overdue: { label: "Overdue", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

let editKeyCounter = 0;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  /* ---- edit mode ---- */
  const [editing, setEditing] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editClientAddress, setEditClientAddress] = useState("");
  const [editBankTransfer, setEditBankTransfer] = useState(false);
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [editError, setEditError] = useState("");

  /* ---- compose email ---- */
  const [composing, setComposing] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailNote, setEmailNote] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  // Sticky success after a successful send — same pattern as the
  // report-summary dialog. Reset on every entry to compose mode.
  const [emailSentTo, setEmailSentTo] = useState<{
    to: string;
    cc: string;
  } | null>(null);

  // ?compose=1 auto-opens the composer on load — used by the Save &
  // Review Email flow on /invoices/new so the user lands here ready
  // to personalise + confirm instead of having to find a button.
  const searchParams = useSearchParams();
  const wantsCompose = searchParams.get("compose") === "1";

  /* ---- delete / cancel confirmation ---- */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  /* ---- load invoice ---- */
  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        setInvoice(await res.json());
      } else {
        setInvoice(null);
      }
    } catch {
      setInvoice(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  // Bank details (for the "Pay by bank transfer" block in the preview).
  const [bankSettings, setBankSettings] = useState<{
    bankAccountName: string;
    bankSortCode: string;
    bankAccountNumber: string;
    bankIban: string;
    bankBic: string;
    bankTransferInstructions: string;
  } | null>(null);
  useEffect(() => {
    fetch("/api/settings/bank")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBankSettings(d))
      .catch(() => {});
  }, []);

  /* ---- enter edit mode ---- */
  function enterEditMode() {
    if (!invoice) return;
    setEditClientName(invoice.clientName);
    setEditClientEmail(invoice.clientEmail);
    setEditClientAddress(invoice.clientAddress || "");
    setEditBankTransfer(invoice.bankTransfer);
    setEditDueDate(new Date(invoice.dueDate).toISOString().split("T")[0]);
    setEditNotes(invoice.notes || "");
    setEditItems(
      invoice.items.map((item) => ({
        key: editKeyCounter++,
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: (item.unitPrice / 100).toFixed(2),
      }))
    );
    setEditError("");
    setEditing(true);
  }

  /* ---- edit item helpers ---- */
  function updateEditItem(key: number, field: keyof EditableItem, value: string | number) {
    setEditItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  }

  function removeEditItem(key: number) {
    setEditItems((prev) => prev.filter((item) => item.key !== key));
  }

  function addEditItem() {
    setEditItems((prev) => [
      ...prev,
      { key: editKeyCounter++, description: "", quantity: 1, unitPrice: "" },
    ]);
  }

  function editItemAmountPence(item: EditableItem): number {
    const price = parseFloat(item.unitPrice) || 0;
    return Math.round(price * 100) * item.quantity;
  }

  const editSubtotalPence = editItems.reduce(
    (sum, item) => sum + editItemAmountPence(item),
    0
  );

  /* ---- save edits ---- */
  async function saveEdits() {
    setEditError("");

    if (!editClientName.trim()) {
      setEditError("Client name is required.");
      return;
    }
    if (!editClientEmail.trim()) {
      setEditError("Client email is required.");
      return;
    }
    if (!editDueDate) {
      setEditError("Due date is required.");
      return;
    }
    if (editItems.length === 0) {
      setEditError("At least one line item is required.");
      return;
    }
    if (editItems.some((item) => !item.description.trim())) {
      setEditError("Each line item must have a description.");
      return;
    }
    if (editItems.some((item) => !item.unitPrice || parseFloat(item.unitPrice) <= 0)) {
      setEditError("Each line item must have a valid unit price.");
      return;
    }

    setActionLoading("save");

    try {
      const body = {
        clientName: editClientName.trim(),
        clientEmail: editClientEmail.trim().toLowerCase(),
        clientAddress: editClientAddress.trim() || null,
        bankTransfer: editBankTransfer,
        dueDate: new Date(editDueDate + "T00:00:00.000Z").toISOString(),
        notes: editNotes.trim() || null,
        items: editItems.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: Math.round(parseFloat(item.unitPrice) * 100),
        })),
      };

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || "Failed to save changes.");
        setActionLoading(null);
        return;
      }

      const updated = await res.json();
      setInvoice(updated);
      setEditing(false);
    } catch {
      setEditError("Something went wrong. Please try again.");
    }

    setActionLoading(null);
  }

  /* ---- start compose ---- */
  function startCompose() {
    if (!invoice) return;
    setEmailSentTo(null); // wipe any "Sent" state from a previous send
    setEmailTo(invoice.clientEmail);
    setEmailCc("");
    setEmailSubject(
      `Invoice ${invoice.invoiceNumber} from The Sensory Submarine`,
    );
    setEmailNote("");
    setComposing(true);
  }

  // Auto-open the composer when the URL says so (e.g. arriving from
  // Save & Review Email on /invoices/new). We only fire this once
  // per invoice load to avoid re-opening if the user dismisses it.
  useEffect(() => {
    if (wantsCompose && invoice && !composing) {
      startCompose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsCompose, invoice]);

  /* ---- send invoice ---- */
  async function sendInvoice(opts?: {
    personalNote?: string;
    cc?: string;
    subject?: string;
    to?: string;
  }) {
    setError("");
    setEmailSending(true);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalNote: opts?.personalNote || undefined,
          cc: opts?.cc || undefined,
          subject: opts?.subject || undefined,
          to: opts?.to || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send invoice.");
        setEmailSending(false);
        return;
      }

      const data = await res.json();
      setInvoice(data.invoice);
      // Don't close the composer — flip to a sticky success card
      // so Patrick has unambiguous confirmation the email went out
      // (and to which addresses). User dismisses with Done.
      setEmailSentTo({
        to: opts?.to || invoice?.clientEmail || "",
        cc: opts?.cc || "",
      });
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setEmailSending(false);
  }

  /* ---- mark as paid ---- */
  async function markAsPaid() {
    setError("");
    setActionLoading("paid");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to mark as paid.");
        setActionLoading(null);
        return;
      }

      const updated = await res.json();
      setInvoice(updated);
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setActionLoading(null);
  }

  /* ---- mark as overdue ---- */
  async function markAsOverdue() {
    setError("");
    setActionLoading("overdue");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "overdue" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to mark as overdue.");
        setActionLoading(null);
        return;
      }

      const updated = await res.json();
      setInvoice(updated);
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setActionLoading(null);
  }

  /* ---- cancel invoice (status → cancelled) ---- */
  async function cancelInvoice() {
    setError("");
    setActionLoading("cancel");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel invoice.");
        setActionLoading(null);
        setConfirmCancel(false);
        return;
      }
      const updated = await res.json();
      setInvoice(updated);
      setConfirmCancel(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setConfirmCancel(false);
    }
    setActionLoading(null);
  }

  /* ---- delete invoice ---- */
  async function deleteInvoice() {
    setError("");
    setActionLoading("delete");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete invoice.");
        setActionLoading(null);
        setConfirmDelete(false);
        return;
      }

      router.push("/invoices");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setActionLoading(null);
      setConfirmDelete(false);
    }
  }

  /* ---- copy payment link ---- */
  function copyPaymentLink() {
    if (!invoice?.paymentUrl) return;
    navigator.clipboard.writeText(invoice.paymentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  /* ---- loading state ---- */
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ---- not found ---- */
  if (!invoice) {
    return (
      <div className="space-y-4">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[invoice.status];
  const isPastDue =
    invoice.status === "sent" && new Date(invoice.dueDate) < new Date();

  /* ------------------------------------------------------------------ */
  /*  EDIT MODE                                                         */
  /* ------------------------------------------------------------------ */
  if (editing) {
    return (
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel editing
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Pencil className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Edit {invoice.invoiceNumber}
            </h1>
          </div>
        </div>

        {editError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {editError}
          </div>
        )}

        {/* Client details */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-semibold">Client</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editClientName">Client Name *</Label>
              <Input
                id="editClientName"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClientEmail">Client Email *</Label>
              <Input
                id="editClientEmail"
                type="email"
                value={editClientEmail}
                onChange={(e) => setEditClientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="editClientAddress">Client Address</Label>
              <textarea
                id="editClientAddress"
                value={editClientAddress}
                onChange={(e) => setEditClientAddress(e.target.value)}
                rows={3}
                placeholder={"12 Main Street\nArmagh\nBT60 1AA"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={editBankTransfer}
                onChange={(e) => setEditBankTransfer(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
              />
              <span>
                <span className="block text-sm font-medium">Offer bank transfer</span>
                <span className="block text-xs text-muted-foreground">
                  Shows your bank details + this invoice number as the
                  reference (for schools / EA finance paying by BACS).
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Invoice details */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-semibold">Details</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDueDate">Due Date *</Label>
              <Input
                id="editDueDate"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-semibold">Line Items</h2>
          <div className="space-y-4">
            {editItems.map((item, index) => (
              <div
                key={item.key}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Item {index + 1}
                  </span>
                  {editItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEditItem(item.key)}
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
                        updateEditItem(item.key, "description", e.target.value)
                      }
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
                          updateEditItem(
                            item.key,
                            "quantity",
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit Price ({invoice.currency === "EUR" ? "\u20ac" : invoice.currency === "USD" ? "$" : "\u00a3"})</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateEditItem(item.key, "unitPrice", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <div className="flex h-8 items-center rounded-lg border border-input bg-muted/50 px-2.5 text-sm font-medium">
                        {formatCurrency(editItemAmountPence(item), invoice.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addEditItem}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(editSubtotalPence, invoice.currency)}
                </span>
              </div>
              {invoice.tax > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tax will be recalculated based on current rates when you save.
                </p>
              )}
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold tracking-tight">
                  {formatCurrency(editSubtotalPence, invoice.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-3">
          <Button
            onClick={saveEdits}
            disabled={actionLoading === "save"}
          >
            {actionLoading === "save" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  COMPOSE EMAIL MODE                                                 */
  /* ------------------------------------------------------------------ */
  if (composing && invoice) {
    const curSymbols: Record<string, string> = { GBP: "\u00a3", EUR: "\u20ac", USD: "$" };
    const sym = curSymbols[invoice.currency] || "\u00a3";

    // Sticky success view \u2014 shown after the user confirms send.
    // Stays until they click Done or Send another. Same shape as
    // the report-summary dialog's success state.
    if (emailSentTo) {
      return (
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setEmailSentTo(null);
              }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to invoice
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
              <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Invoice email sent successfully</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{invoice.invoiceNumber}</strong>{" "}
              delivered to{" "}
              <strong className="text-foreground">{emailSentTo.to}</strong>
              {emailSentTo.cc && (
                <>
                  {" "}with a copy to{" "}
                  <strong className="text-foreground">{emailSentTo.cc}</strong>
                </>
              )}
              .
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sent from <span className="font-mono">info@mail.thesensorysubmarine.com</span>
              {" \u00b7 "}Pay-now link included
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setComposing(false);
                  setEmailSentTo(null);
                }}
              >
                Done
              </Button>
              <Button
                onClick={() => {
                  // Re-enter compose mode for a follow-up send
                  // (e.g. to a school SENCO with a CC to a parent).
                  // startCompose() resets all fields including the
                  // success state.
                  startCompose();
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send another
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setComposing(false)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoice
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Compose Email</h1>
            <p className="text-sm text-muted-foreground">
              {invoice.invoiceNumber} &middot; {formatCurrency(invoice.total, invoice.currency)}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left -- compose fields */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
              <h2 className="mb-4 text-sm font-semibold">Email Details</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailTo">To</Label>
                  <Input
                    id="emailTo"
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailCc">CC <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="emailCc"
                    type="email"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder="e.g. accounts@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailSubject">Subject</Label>
                  <Input
                    id="emailSubject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailNote">Personal Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    id="emailNote"
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                    placeholder="Add a personal message that will appear at the top of the email..."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Payment link info */}
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                  <ExternalLink className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Pay Now button included
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    A payment link via FireBuddy will be created and included in the email.
                  </p>
                </div>
              </div>
            </div>

            {/* Send button */}
            <Button
              onClick={() =>
                sendInvoice({
                  to: emailTo,
                  cc: emailCc,
                  subject: emailSubject,
                  personalNote: emailNote,
                })
              }
              disabled={emailSending || !emailTo.trim()}
              className="w-full"
              size="lg"
            >
              {emailSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invoice Email
                </>
              )}
            </Button>
          </div>

          {/* Right -- email preview */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="bg-muted/30 px-6 py-3 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Preview
                </p>
              </div>

              {/* "Envelope" header — mimics what the recipient sees in
                  their inbox. Mirrors the live To/CC/Subject fields so
                  Patrick can confirm the addressing before he hits Send. */}
              <div className="border-b border-border bg-muted/10 px-6 py-3 text-xs">
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 font-semibold text-muted-foreground">To</span>
                  <span className="truncate">{emailTo || invoice.clientEmail}</span>
                </div>
                {emailCc && (
                  <div className="mt-1 flex gap-2">
                    <span className="w-12 shrink-0 font-semibold text-muted-foreground">Cc</span>
                    <span className="truncate">{emailCc}</span>
                  </div>
                )}
                <div className="mt-1 flex gap-2">
                  <span className="w-12 shrink-0 font-semibold text-muted-foreground">Subject</span>
                  <span className="truncate font-medium">{emailSubject || `Invoice ${invoice.invoiceNumber} from The Sensory Submarine`}</span>
                </div>
              </div>

              <div className="p-6">
                {/* Preview header */}
                <div className="rounded-xl bg-[#1a1a2e] p-5 text-center text-white">
                  <p className="text-lg font-bold">The Sensory Submarine</p>
                  <p className="mt-1 text-xs opacity-70">Occupational Therapy Services</p>
                </div>

                <div className="mt-6 space-y-4">
                  <p className="text-sm text-foreground">
                    Hi {invoice.clientName},
                  </p>

                  {emailNote && (
                    <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">
                      {emailNote}
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Please find your invoice below.
                  </p>

                  {invoice.clientAddress && (
                    <div className="text-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Bill to
                      </p>
                      <p className="mt-1 font-semibold">{invoice.clientName}</p>
                      <p className="whitespace-pre-line text-muted-foreground">
                        {invoice.clientAddress}
                      </p>
                    </div>
                  )}

                  {/* Invoice summary */}
                  <div className="rounded-xl bg-muted/30 p-4">
                    <div className="flex justify-between text-sm">
                      <span>Invoice Number</span>
                      <span className="font-medium">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span>Due Date</span>
                      <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="space-y-2">
                    {invoice.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.description}</span>
                        <span className="font-medium">{sym}{(item.amount / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">{sym}{(invoice.subtotal / 100).toFixed(2)}</span>
                      </div>
                      {invoice.tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax</span>
                          <span className="font-medium">{sym}{(invoice.tax / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-border pt-1 flex justify-between">
                        <span className="text-sm font-bold">Total</span>
                        <span className="text-sm font-bold">{sym}{(invoice.total / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pay by bank transfer block — shows when this
                      invoice has the option enabled and bank details
                      are configured. Reference = invoice number. */}
                  {invoice.bankTransfer &&
                    bankSettings &&
                    (bankSettings.bankAccountName ||
                      bankSettings.bankSortCode ||
                      bankSettings.bankAccountNumber ||
                      bankSettings.bankIban ||
                      bankSettings.bankBic) && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          Pay by bank transfer
                        </p>
                        <div className="mt-2 space-y-1">
                          {bankSettings.bankAccountName && (
                            <Row k="Account name" v={bankSettings.bankAccountName} />
                          )}
                          {bankSettings.bankSortCode && (
                            <Row k="Sort code" v={bankSettings.bankSortCode} />
                          )}
                          {bankSettings.bankAccountNumber && (
                            <Row k="Account number" v={bankSettings.bankAccountNumber} />
                          )}
                          {bankSettings.bankIban && (
                            <Row k="IBAN" v={bankSettings.bankIban} />
                          )}
                          {bankSettings.bankBic && (
                            <Row k="BIC / SWIFT" v={bankSettings.bankBic} />
                          )}
                          <Row k="Reference" v={invoice.invoiceNumber} />
                        </div>
                        {bankSettings.bankTransferInstructions && (
                          <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                            {bankSettings.bankTransferInstructions}
                          </p>
                        )}
                      </div>
                    )}

                  {invoice.bankTransfer && !bankSettings?.bankAccountName && !bankSettings?.bankIban && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      Bank transfer is enabled, but no bank details are set yet —
                      add them in Settings → Payments so they appear on the
                      invoice.
                    </div>
                  )}

                  {/* Pay Now button preview — kept visually in step
                      with the actual email template so what Patrick
                      sees here is what the recipient gets. */}
                  <div className="py-2 text-center">
                    <div className="inline-block rounded-xl bg-[#1a1a2e] px-10 py-3.5 text-sm font-bold text-white shadow-md">
                      Pay&nbsp;{sym}{(invoice.total / 100).toFixed(2)}&nbsp;now&nbsp;→
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Secure payment via FireBuddy
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    If you have any questions, please don&apos;t hesitate to get in touch.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Kind regards,<br />
                    <span className="font-semibold">The Sensory Submarine</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  READ MODE                                                         */
  /* ------------------------------------------------------------------ */
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {invoice.invoiceNumber}
            </h1>
          </div>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ---- Client Info ---- */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Client
        </h2>
        <p className="mt-2 text-sm font-semibold">{invoice.clientName}</p>
        <p className="text-sm text-muted-foreground">
          <a
            href={`mailto:${invoice.clientEmail}`}
            className="text-primary hover:underline"
          >
            {invoice.clientEmail}
          </a>
        </p>
        {invoice.clientAddress && (
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {invoice.clientAddress}
          </p>
        )}
      </div>

      {/* ---- Invoice Details ---- */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Invoice Details
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium">
              {formatDateFull(invoice.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p
              className={`text-sm font-medium ${
                isPastDue ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {formatDateFull(invoice.dueDate)}
              {isPastDue && " (overdue)"}
            </p>
          </div>
          {invoice.sentAt && (
            <div>
              <p className="text-xs text-muted-foreground">Sent</p>
              <p className="text-sm font-medium">
                {formatDateFull(invoice.sentAt)}
              </p>
            </div>
          )}
          {invoice.paidAt && (
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {formatDateFull(invoice.paidAt)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Items Table ---- */}
      <div className="mb-4 rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Items
          </h2>
        </div>

        {/* Desktop table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-3 text-foreground">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium">
                    {formatCurrency(item.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td
                  colSpan={3}
                  className="px-6 py-2 text-right text-sm text-muted-foreground"
                >
                  Subtotal
                </td>
                <td className="px-6 py-2 text-right text-sm font-medium">
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </td>
              </tr>
              {invoice.tax > 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-2 text-right text-sm text-muted-foreground"
                  >
                    Tax
                  </td>
                  <td className="px-6 py-2 text-right text-sm font-medium">
                    {formatCurrency(invoice.tax, invoice.currency)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-border bg-muted/30">
                <td
                  colSpan={3}
                  className="px-6 py-3 text-right text-sm font-semibold"
                >
                  Total
                </td>
                <td className="px-6 py-3 text-right text-base font-bold">
                  {formatCurrency(invoice.total, invoice.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ---- Notes ---- */}
      {invoice.notes && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {invoice.notes}
          </p>
        </div>
      )}

      {/* ---- Payment Link ---- */}
      {invoice.paymentUrl && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Payment Link
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <a
              href={invoice.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {invoice.paymentUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {invoice.paymentRef && (
            <p className="mt-1 text-xs text-muted-foreground">
              Reference: {invoice.paymentRef}
            </p>
          )}
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="flex flex-wrap gap-3">
        {/* Universal admin actions — Edit / Cancel / Delete are
            available on every status except Paid (which is locked
            for accounting integrity). Status-specific actions like
            Mark as Paid / Compose Email follow below. */}
        {invoice.status !== "paid" && (
          <>
            <Button variant="outline" onClick={enterEditMode}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>

            {/* Cancel — only meaningful when not already cancelled */}
            {invoice.status !== "cancelled" && (
              !confirmCancel ? (
                <Button
                  variant="outline"
                  onClick={() => setConfirmCancel(true)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel invoice
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Cancel this invoice? It will be marked as
                    cancelled but stays on the list for audit.
                  </span>
                  <Button
                    size="sm"
                    onClick={cancelInvoice}
                    disabled={actionLoading === "cancel"}
                  >
                    {actionLoading === "cancel" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Yes, cancel"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmCancel(false)}
                  >
                    Keep
                  </Button>
                </div>
              )
            )}

            {/* Delete — destructive, removes the row entirely */}
            {!confirmDelete ? (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-950/30">
                <span className="text-sm text-red-600 dark:text-red-400">
                  Delete permanently?
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteInvoice}
                  disabled={actionLoading === "delete"}
                >
                  {actionLoading === "delete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Yes, delete"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </Button>
              </div>
            )}
          </>
        )}

        {/* Draft-only: surface Compose Email up here */}
        {invoice.status === "draft" && (
          <Button onClick={startCompose}>
            <Mail className="mr-2 h-4 w-4" />
            Compose Email
          </Button>
        )}

        {/* Sent actions */}
        {invoice.status === "sent" && (
          <>
            <Button onClick={startCompose} variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Compose Email
            </Button>
            <Button
              onClick={markAsPaid}
              disabled={actionLoading === "paid"}
            >
              {actionLoading === "paid" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Paid
                </>
              )}
            </Button>
            {invoice.paymentUrl && (
              <Button variant="outline" onClick={copyPaymentLink}>
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Payment Link
                  </>
                )}
              </Button>
            )}
            {isPastDue && (
              <Button
                variant="destructive"
                onClick={markAsOverdue}
                disabled={actionLoading === "overdue"}
              >
                {actionLoading === "overdue" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Mark as Overdue"
                )}
              </Button>
            )}
          </>
        )}

        {/* Overdue actions */}
        {invoice.status === "overdue" && (
          <>
            <Button onClick={startCompose} variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Compose Email
            </Button>
            <Button
              onClick={markAsPaid}
              disabled={actionLoading === "paid"}
            >
              {actionLoading === "paid" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Paid
                </>
              )}
            </Button>
            {invoice.paymentUrl && (
              <Button variant="outline" onClick={copyPaymentLink}>
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Payment Link
                  </>
                )}
              </Button>
            )}
          </>
        )}

        {/* Paid - read only with payment details */}
        {invoice.status === "paid" && invoice.paidAt && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 dark:border-green-800 dark:bg-green-950/30">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Paid on {formatDate(invoice.paidAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small key/value row for the bank-transfer preview block. */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
