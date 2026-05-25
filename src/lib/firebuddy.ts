const FIREBUDDY_API =
  "https://srjrxyobhfegimgqfpor.supabase.co/functions/v1/firebuddy-api";

export interface CreatePaymentOptions {
  amount: number;
  currency?: "EUR" | "GBP" | "USD";
  description: string;
  reference?: string;
  email?: string;
  returnUrl?: string;
}

export interface PaymentResult {
  paymentUrl: string;
  code: string;
  paymentId: string;
  paymentLinkId?: string;
}

export interface PaymentStatus {
  id: string;
  status: "pending" | "completed" | "failed";
  amount: number;
  currency: string;
  fire_payment_code: string;
  customer_email: string | null;
  created_at: string;
  updated_at: string;
}

/** Line item shape FireBuddy expects on POST /invoices. */
export interface FireBuddyInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number; // pence/cents
  amount: number;     // quantity * unit_price, pence/cents
}

export interface CreateInvoiceOptions {
  invoice_number: string;
  currency?: "EUR" | "GBP" | "USD";
  client_name?: string;
  client_email?: string;
  issue_date?: string; // YYYY-MM-DD
  due_date?: string;   // YYYY-MM-DD
  notes?: string;
  items: FireBuddyInvoiceItem[];
  /// If we already have a payment-request, pass the URL + ref here so
  /// the invoice in FireBuddy's UI carries the same pay link.
  payment_url?: string;
  payment_reference?: string;
  /// Optional initial status — defaults to "draft" on the FireBuddy side.
  status?: "draft" | "sent" | "paid" | "cancelled";
}

export interface UpdateInvoicePatch {
  status?: "draft" | "sent" | "paid" | "cancelled";
  payment_url?: string;
  payment_reference?: string;
  due_date?: string;
  notes?: string;
}

export interface InvoiceResult {
  id: string;
  invoice_number: string;
  status: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  currency?: string;
  payment_url?: string | null;
  payment_reference?: string | null;
  client_id?: string;
  created_at?: string;
}

export interface FireBuddyEvent {
  event: "payment.completed";
  paymentId: string;
  amount: number;
  currency: string;
  reference: string;
  firePaymentCode: string | null;
  customerEmail: string | null;
  timestamp: string;
}

export class FireBuddy {
  constructor(private apiKey: string) {
    if (!apiKey?.startsWith("fb_live_")) {
      throw new Error("Invalid FireBuddy API key — must start with fb_live_");
    }
  }

  private async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${FIREBUDDY_API}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || `FireBuddy API error: ${res.status}`);
    return data;
  }

  async createPayment(opts: CreatePaymentOptions): Promise<PaymentResult> {
    return this.call("POST", "payment-requests", opts);
  }

  async getPaymentStatus(code: string): Promise<PaymentStatus> {
    return this.call("GET", `payment-requests/${code}`);
  }

  // ── Invoices ────────────────────────────────────────────────────
  //
  // FireBuddy's invoice endpoint is separate from payment-requests
  // — invoices live in their accounting view (Accounting → Invoices)
  // and exist primarily so an accountant has a clean record of what
  // was billed to whom. Schema discovered empirically 2026-05-25:
  //
  //   POST /invoices       — requires invoice_number + items[].
  //   PATCH /invoices/{id} — supports status, payment_url,
  //                          payment_reference, due_date, notes.
  //   DELETE /invoices/{id} — NOT supported; PATCH status="cancelled"
  //                           is the soft-delete instead.
  async createInvoice(opts: CreateInvoiceOptions): Promise<InvoiceResult> {
    return this.call("POST", "invoices", opts);
  }

  async updateInvoice(
    id: string,
    patch: UpdateInvoicePatch,
  ): Promise<InvoiceResult> {
    return this.call("PATCH", `invoices/${id}`, patch);
  }

  static async verifyWebhook(
    signature: string | null,
    rawBody: string,
    secret: string
  ): Promise<FireBuddyEvent> {
    if (!signature) throw new Error("Missing x-firebuddy-signature header");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (signature !== expected) throw new Error("Invalid webhook signature");
    return JSON.parse(rawBody) as FireBuddyEvent;
  }
}
