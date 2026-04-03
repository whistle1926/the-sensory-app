"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentStatus = "checking" | "completed" | "pending" | "failed";

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking");
  const [status, setStatus] = useState<PaymentStatus>("checking");
  const [bookingDetails, setBookingDetails] = useState<{
    service: string;
    date: string;
    time: string;
    clientName: string;
    clientEmail: string;
  } | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setStatus("failed");
      return;
    }

    async function checkStatus() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/status`);
        if (!res.ok) {
          setStatus("failed");
          return;
        }
        const data = await res.json();
        setBookingDetails(data);

        if (data.paymentStatus === "paid") {
          setStatus("completed");
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("pending");
      }
    }

    checkStatus();
  }, [bookingId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 glass">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
                <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
                <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
                <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">
              The Sensory Submarine
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        {status === "checking" && (
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="text-xl font-bold">Checking payment status...</h1>
          </div>
        )}

        {status === "completed" && (
          <div className="space-y-6 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Payment Successful</h1>
            <p className="text-muted-foreground">
              Your booking is confirmed{bookingDetails ? ` and a confirmation will be sent to ${bookingDetails.clientEmail}` : ""}.
            </p>

            {bookingDetails && (
              <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-sm)]">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{bookingDetails.service}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">{new Date(bookingDetails.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{bookingDetails.time}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() => window.location.href = "/book"}
              variant="outline"
              className="rounded-xl"
            >
              Book another session
            </Button>
          </div>
        )}

        {status === "pending" && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold">Payment Processing</h1>
            <p className="text-muted-foreground">
              Your booking has been received and payment is being processed. You will receive a confirmation email once payment is complete.
            </p>
            <Button
              onClick={() => window.location.href = "/book"}
              variant="outline"
              className="rounded-xl"
            >
              Back to booking
            </Button>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">Something Went Wrong</h1>
            <p className="text-muted-foreground">
              We could not verify your payment. Please contact us if you believe this is an error.
            </p>
            <Button
              onClick={() => window.location.href = "/book"}
              variant="outline"
              className="rounded-xl"
            >
              Try again
            </Button>
          </div>
        )}
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        <p>
          The Sensory Submarine &middot; Occupational Therapy Services &middot;
          Northern Ireland
        </p>
      </footer>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
