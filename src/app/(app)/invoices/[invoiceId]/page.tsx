"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Send,
  Trash2,
  Plus,
  Copy,
  CheckCircle2,
  Loader2,
  Pencil,
  Receipt,
  ExternalLink,
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

function formatCurrency(pence: number): string {
  return (pence / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
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
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [editError, setEditError] = useState("");

  /* ---- delete confirmation ---- */
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  /* ---- enter edit mode ---- */
  function enterEditMode() {
    if (!invoice) return;
    setEditClientName(invoice.clientName);
    setEditClientEmail(invoice.clientEmail);
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

  /* ---- send invoice ---- */
  async function sendInvoice() {
    setError("");
    setActionLoading("send");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send invoice.");
        setActionLoading(null);
        return;
      }

      const data = await res.json();
      setInvoice(data.invoice);
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setActionLoading(null);
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
                      <Label>Unit Price (&pound;)</Label>
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
                        {formatCurrency(editItemAmountPence(item))}
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

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold tracking-tight">
                  {formatCurrency(editSubtotalPence)}
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
  /*  READ MODE                                                         */
  /* ------------------------------------------------------------------ */
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
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td
                  colSpan={3}
                  className="px-6 py-3 text-right text-sm font-semibold"
                >
                  Total
                </td>
                <td className="px-6 py-3 text-right text-base font-bold">
                  {formatCurrency(invoice.total)}
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
        {/* Draft actions */}
        {invoice.status === "draft" && (
          <>
            <Button variant="outline" onClick={enterEditMode}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              onClick={sendInvoice}
              disabled={actionLoading === "send"}
            >
              {actionLoading === "send" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invoice
                </>
              )}
            </Button>
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
                  Are you sure?
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
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}

        {/* Sent actions */}
        {invoice.status === "sent" && (
          <>
            <Button
              onClick={sendInvoice}
              disabled={actionLoading === "send"}
              variant="outline"
            >
              {actionLoading === "send" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Resend
                </>
              )}
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
            <Button
              onClick={sendInvoice}
              disabled={actionLoading === "send"}
              variant="outline"
            >
              {actionLoading === "send" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Resend
                </>
              )}
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
