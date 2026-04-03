const FIREBUDDY_API =
  "https://srjrxyobhfegimgqfpor.supabase.co/functions/v1/firebuddy-api";

export interface CreatePaymentOptions {
  amount: number;
  currency?: "EUR" | "GBP";
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
