"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { SubmarineHeader } from "@/components/storefront/submarine-header";

type PaymentStatus = "checking" | "completed" | "pending" | "failed";

const SECONDARY_BUTTON =
  "sub-edge sub-press inline-flex items-center gap-2 rounded-full bg-[#FFC93C] px-6 py-3.5 text-[15px] font-extrabold text-[#12235B]";

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking");
  const newAccount = searchParams.get("newAccount") === "1";
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

    // The booking confirms once the client's bank has authorised the
    // payment — usually within a minute of them approving it in their
    // banking app. Keep asking for a while rather than giving up on the
    // first look, so most clients see "confirmed" without refreshing.
    let attempts = 0;
    const maxAttempts = 45; // 2s × 45 ≈ 90s
    let cancelled = false;

    async function checkStatus() {
      attempts++;
      try {
        const res = await fetch(`/api/bookings/${bookingId}/status`);
        if (!res.ok) {
          if (!cancelled) setStatus("failed");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setBookingDetails(data);

        if (data.paymentStatus === "paid") {
          setStatus("completed");
          return;
        }
      } catch {
        /* keep trying */
      }
      if (cancelled) return;
      setStatus("pending");
      if (attempts < maxAttempts) setTimeout(checkStatus, 2000);
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />

      <main className="mx-auto max-w-lg px-5 py-16 sm:py-20">
        <div className="sub-edge-xl rounded-[34px] bg-white p-8 text-center sm:p-10">
          {status === "checking" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#6B7794]" />
              <h1 className="sub-display mt-4 text-[30px]">
                Checking payment status…
              </h1>
            </>
          )}

          {status === "completed" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#17B0A7]" />
              <h1 className="sub-display mt-4 text-[30px]">Payment successful</h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                Your booking is confirmed{bookingDetails ? ` and a confirmation will be sent to ${bookingDetails.clientEmail}` : ""}.
              </p>

              {bookingDetails && (
                <div className="sub-edge mt-6 rounded-[26px] bg-[#FFFCF6] p-5 text-left">
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold text-[#6B7794]">Service</span>
                      <span className="text-right font-extrabold">{bookingDetails.service}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold text-[#6B7794]">Date</span>
                      <span className="text-right font-extrabold">{new Date(bookingDetails.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold text-[#6B7794]">Time</span>
                      <span className="text-right font-extrabold">{bookingDetails.time}</span>
                    </div>
                  </div>
                </div>
              )}

              {newAccount && (
                <div className="mt-5 rounded-[18px] border-2 border-[#C2E7E3] bg-[#E7F6F4] px-4 py-3.5 text-left text-sm">
                  <p className="font-extrabold text-[#0E6F68]">Your account is ready</p>
                  <p className="mt-1 font-semibold text-[#3D4A6B]">
                    We&rsquo;ve created an account so you can manage this booking. Check your email for a link to set your password.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => window.location.href = "/book"}
                className={`${SECONDARY_BUTTON} mt-6`}
              >
                Book another session
              </button>
            </>
          )}

          {status === "pending" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2]">
                <Clock className="h-8 w-8 text-[#B7791F]" />
              </div>
              <h1 className="sub-display mt-4 text-[30px]">Your bank is still confirming</h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                Your booking has been received. If you approved the payment in your banking app, you&rsquo;re all set &mdash; we&rsquo;ll email your confirmation the moment your bank confirms it, usually within a few minutes.
              </p>
              <button
                type="button"
                onClick={() => window.location.href = "/book"}
                className={`${SECONDARY_BUTTON} mt-6`}
              >
                Back to booking
              </button>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FBC7D7] bg-[#FFE7EE]">
                <AlertCircle className="h-8 w-8 text-[#B81243]" />
              </div>
              <h1 className="sub-display mt-4 text-[30px]">Something went wrong</h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                We could not verify your payment. Please contact us if you believe this is an error.
              </p>
              <button
                type="button"
                onClick={() => window.location.href = "/book"}
                className={`${SECONDARY_BUTTON} mt-6`}
              >
                Try again
              </button>
            </>
          )}
        </div>
      </main>

      <footer className="border-t-2 border-[#F2E4CD] py-6 text-center text-xs font-semibold text-[#6B7794]">
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
      <div className="sub flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6B7794]" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
