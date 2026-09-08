"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, Mail, AlertCircle } from "lucide-react";
import { SubmarineHeader } from "@/components/storefront/submarine-header";

interface PurchaseStatus {
  id: string;
  paymentStatus: "pending" | "paid" | "failed";
  courseId: string;
  amount: number;
}

type Phase = "polling" | "slow" | "paid" | "timeout" | "failed";

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
    // Fire reports "authorised" once the bank approves — usually under a
    // minute, but Grace's own test took nearly two, and the page used to
    // give up at 90s and tell her it was stuck. So: poll briskly for the
    // first 90s, then keep going quietly (every 5s) for up to ten minutes
    // with a "taking longer than usual" note. Only after that do we send
    // the buyer to their inbox.
    const started = Date.now();
    const FAST_MS = 90_000;
    const GIVE_UP_MS = 10 * 60_000;
    let cancelled = false;

    async function poll() {
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
      if (cancelled) return;
      const elapsed = Date.now() - started;
      if (elapsed >= GIVE_UP_MS) {
        setPhase("timeout");
        return;
      }
      if (elapsed >= FAST_MS) setPhase("slow");
      setTimeout(poll, elapsed >= FAST_MS ? 5000 : 2000);
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
    <div className="sub min-h-screen">
      <SubmarineHeader />
      <div className="mx-auto max-w-lg px-5 py-20">
        <div className="sub-edge-xl rounded-[34px] bg-white p-10 text-center">
          {(phase === "polling" || phase === "slow") && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#6B7794]" />
              <h1 className="sub-display mt-4 text-[30px]">
                {phase === "slow"
                  ? "Nearly there…"
                  : "Finalising your purchase…"}
              </h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                {phase === "slow"
                  ? "Your bank is taking a little longer than usual to confirm. Keep this page open — the moment it comes through, your course will unlock here and we'll email you too."
                  : "Just a moment while your bank confirms the payment. This usually takes under a minute."}
              </p>
            </>
          )}

          {phase === "paid" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#17B0A7]" />
              <h1 className="sub-display mt-4 text-[30px]">You're in!</h1>
              {session?.user ? (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                    Taking you to your course now…
                  </p>
                  {purchase && (
                    <Link
                      href={`/portal/training/${purchase.courseId}`}
                      className="mt-4 inline-block text-[15px] font-extrabold text-[#E71D57] hover:text-[#B81243]"
                    >
                      Open course now
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                    Check your inbox — we've sent you a link to set a password
                    and jump into the course.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-4 py-2.5 text-sm font-bold">
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
              <h1 className="sub-display mt-4 text-[30px]">Your bank is still confirming</h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                If you approved the payment in your banking app, you&apos;re
                all set — we&apos;ll email your access link the moment your
                bank confirms it, usually within a few minutes. You can also
                refresh this page to check.
              </p>
              <Link
                href="/courses"
                className="mt-4 inline-block text-[15px] font-extrabold text-[#E71D57] hover:text-[#B81243]"
              >
                Back to courses
              </Link>
            </>
          )}

          {phase === "failed" && (
            <>
              <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
              <h1 className="sub-display mt-4 text-[30px]">Payment didn't go through</h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                Nothing has been charged. Please try again, or contact the
                practice if the problem persists.
              </p>
              <Link
                href="/courses"
                className="mt-4 inline-block text-[15px] font-extrabold text-[#E71D57] hover:text-[#B81243]"
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
