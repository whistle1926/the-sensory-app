"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Clock, XCircle } from "lucide-react";

type State =
  | { kind: "polling" }
  | { kind: "paid" }
  | { kind: "failed"; message: string }
  | { kind: "timeout" };

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

export default function PurchasedPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase");

  const [state, setState] = useState<State>({ kind: "polling" });

  useEffect(() => {
    if (!purchaseId) {
      setState({ kind: "failed", message: "Missing purchase reference." });
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/portal/training/purchase/${purchaseId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setState({ kind: "failed", message: "We couldn't find that purchase." });
            return;
          }
          throw new Error(String(res.status));
        }
        const data = (await res.json()) as { paymentStatus: string };
        if (data.paymentStatus === "paid") {
          if (cancelled) return;
          setState({ kind: "paid" });
          // Small delay so the user sees the success state before we navigate.
          setTimeout(() => router.replace(`/portal/training/${courseId}`), 800);
          return;
        }
        if (data.paymentStatus === "failed") {
          setState({
            kind: "failed",
            message: "Payment was declined. Please try again.",
          });
          return;
        }
      } catch {
        // Fall through to retry — transient errors shouldn't end the poll.
      }

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        if (!cancelled) setState({ kind: "timeout" });
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [purchaseId, courseId, router]);

  return (
    <div className="mx-auto max-w-md py-8 sm:py-12">
      <div className="sub-edge-lg space-y-6 rounded-[26px] bg-white p-7 text-center sm:p-9">
        {state.kind === "polling" && (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#E7F6F4]">
              <Loader2 className="h-8 w-8 animate-spin text-[#17B0A7]" />
            </span>
            <div>
              <h1 className="sub-display text-2xl leading-tight">
                Confirming your payment…
              </h1>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#3D4A6B]">
                This usually takes a few seconds. Please don&apos;t close this page.
              </p>
            </div>
          </>
        )}

        {state.kind === "paid" && (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#FFC93C]">
              <CheckCircle2 className="h-8 w-8 text-[#12235B]" />
            </span>
            <div>
              <h1 className="sub-display text-2xl leading-tight">You&apos;re enrolled!</h1>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#3D4A6B]">
                Taking you to the course now…
              </p>
            </div>
          </>
        )}

        {state.kind === "timeout" && (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#FFF3D2]">
              <Clock className="h-8 w-8 text-[#12235B]" />
            </span>
            <div>
              <h1 className="sub-display text-2xl leading-tight">
                Still processing
              </h1>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#3D4A6B]">
                Your payment is taking a little longer than usual. It will appear
                in your training once confirmed — refresh this page in a minute,
                or head back to your training list.
              </p>
            </div>
            <Link
              href="/portal/training"
              className="sub-edge sub-press inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
              style={{ background: "var(--sub-pink)" }}
            >
              Back to training
            </Link>
          </>
        )}

        {state.kind === "failed" && (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#FFE7EE]">
              <XCircle className="h-8 w-8 text-[#E71D57]" />
            </span>
            <div>
              <h1 className="sub-display text-2xl leading-tight">
                We couldn&apos;t confirm your payment
              </h1>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#3D4A6B]">{state.message}</p>
            </div>
            <Link
              href="/portal/training"
              className="sub-edge sub-press inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
              style={{ background: "var(--sub-pink)" }}
            >
              Back to training
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
