"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, Mail, AlertCircle } from "lucide-react";
import { StorefrontHeader } from "@/components/courses/storefront-header";

interface PurchaseStatus {
  id: string;
  paymentStatus: "pending" | "paid" | "failed";
  courseId: string;
  amount: number;
}

type Phase = "polling" | "paid" | "timeout" | "failed";

export default function CourseThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const sp = use(searchParams);
  const purchaseId = sp.purchase;
  const { data: session } = useSession();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("polling");
  const [purchase, setPurchase] = useState<PurchaseStatus | null>(null);

  useEffect(() => {
    if (!purchaseId) {
      setPhase("timeout");
      return;
    }
    let attempts = 0;
    const maxAttempts = 15; // 2s × 15 ≈ 30s
    let cancelled = false;

    async function poll() {
      attempts++;
      try {
        const res = await fetch(
          `/api/courses/public/purchase/${purchaseId}`,
        );
        if (res.ok) {
          const data: PurchaseStatus = await res.json();
          if (cancelled) return;
          setPurchase(data);
          if (data.paymentStatus === "paid") {
            setPhase("paid");
            return;
          }
          if (data.paymentStatus === "failed") {
            setPhase("failed");
            return;
          }
        }
      } catch {
        /* ignore and retry */
      }
      if (attempts >= maxAttempts) {
        if (!cancelled) setPhase("timeout");
        return;
      }
      setTimeout(poll, 2000);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  // Auto-redirect if the buyer is signed in.
  useEffect(() => {
    if (phase === "paid" && session?.user && purchase?.courseId) {
      const t = setTimeout(() => {
        router.push(`/portal/training/${purchase.courseId}`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [phase, session, purchase, router]);

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <StorefrontHeader />
      <div className="mx-auto max-w-lg px-5 py-20">
        <div className="rounded-3xl border border-border bg-white p-10 text-center shadow-[var(--shadow-sm)]">
          {phase === "polling" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-bold">Finalising your purchase…</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Just a moment while we confirm payment with FireBuddy. This
                usually takes a few seconds.
              </p>
            </>
          )}

          {phase === "paid" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <h1 className="mt-4 text-2xl font-bold">You're in!</h1>
              {session?.user ? (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Taking you to your course now…
                  </p>
                  {purchase && (
                    <Link
                      href={`/portal/training/${purchase.courseId}`}
                      className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
                    >
                      Open course now
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Check your inbox — we've sent you a link to set a password
                    and jump into the course.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                    <Mail className="h-4 w-4" />
                    Email on the way
                  </div>
                </>
              )}
            </>
          )}

          {phase === "timeout" && (
            <>
              <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
              <h1 className="mt-4 text-2xl font-bold">Still processing</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If you've paid, your course is on the way. Refresh this page
                shortly or check your email — we'll send a confirmation as soon
                as payment lands.
              </p>
              <Link
                href="/courses"
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Back to courses
              </Link>
            </>
          )}

          {phase === "failed" && (
            <>
              <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
              <h1 className="mt-4 text-2xl font-bold">Payment didn't go through</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing has been charged. Please try again, or contact the
                practice if the problem persists.
              </p>
              <Link
                href="/courses"
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Back to courses
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
