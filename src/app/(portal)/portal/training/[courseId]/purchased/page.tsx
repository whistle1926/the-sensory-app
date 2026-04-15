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
    <div className="mx-auto max-w-md space-y-6 py-12 text-center">
      {state.kind === "polling" && (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Confirming your payment…
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This usually takes a few seconds. Please don&apos;t close this page.
            </p>
          </div>
        </>
      )}

      {state.kind === "paid" && (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">You&apos;re enrolled!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Taking you to the course now…
            </p>
          </div>
        </>
      )}

      {state.kind === "timeout" && (
        <>
          <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Still processing
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment is taking a little longer than usual. It will appear
              in your training once confirmed — refresh this page in a minute,
              or head back to your training list.
            </p>
          </div>
          <Link
            href="/portal/training"
            className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
          >
            Back to training
          </Link>
        </>
      )}

      {state.kind === "failed" && (
        <>
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              We couldn&apos;t confirm your payment
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Link
            href="/portal/training"
            className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
          >
            Back to training
          </Link>
        </>
      )}
    </div>
  );
}
